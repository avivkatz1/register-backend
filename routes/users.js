const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { normalizeAccommodations } = require('../shared/accommodations');

// All routes require an authenticated coach
router.use(authenticateToken, requireRole('admin', 'teacher'));

function toResponse(user) {
  if (!user) return user;
  // coachPin stays out of roster responses — it's only returned by /auth/me
  const { passwordHash, coachPin, ...rest } = user;
  rest.accommodations = normalizeAccommodations(rest.accommodations);
  rest.notes = rest.notes || [];
  return rest;
}

// Slugify a display name into a unique username within the coach's roster
async function makeStudentUsername(coach, displayName) {
  const base =
    String(displayName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'student';
  const roster = await store.listUsersByCoach(coach);
  const taken = new Set(roster.map((u) => String(u.username).toLowerCase()));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

// Get roster (all users under this coach)
router.get('/', async (req, res) => {
  try {
    const users = await store.listUsersByCoach(req.user.coach);
    res.json({ users: users.map(toResponse) });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create a student (email/password optional — students sign in on the iPad
// through the coach session, per their login-method accommodation)
router.post('/', async (req, res) => {
  try {
    const { username, email, password, displayName, role, accommodations } = req.body;

    const name = (displayName || username || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'A student name is required' });
    }

    const finalUsername = username
      ? String(username).trim()
      : await makeStudentUsername(req.user.coach, name);

    const existing = await store.findUserConflict({
      coach: req.user.coach,
      username: finalUsername,
      email: email || undefined
    });
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const user = {
      id: uuidv4(),
      type: 'user',
      coach: req.user.coach,
      username: finalUsername,
      email: email || null,
      passwordHash: password ? await bcrypt.hash(password, 12) : null,
      displayName: name,
      // Only the coach (admin) may create teacher accounts
      role: role === 'teacher' && req.user.role === 'admin' ? 'teacher' : 'student',
      accommodations: normalizeAccommodations(accommodations),
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await store.createUser(user);
    res.status(201).json({ user: toResponse(user) });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update a user (accommodations merge with existing + defaults)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, displayName, role, accommodations, password } = req.body;

    const user = await store.getUserById(id, req.user.coach);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Coach accounts are managed via /auth/me, and only an admin may grant
    // roles — a teacher token must not be able to promote anyone (or itself).
    if (user.role === 'admin' && user.id !== req.user.id) {
      return res.status(403).json({ error: 'Coach accounts cannot be edited here' });
    }
    if (role && role !== user.role && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the coach can change roles' });
    }

    if (username) user.username = username;
    if (email !== undefined) user.email = email || null;
    if (displayName) user.displayName = displayName;
    if (role && ['student', 'teacher', 'admin'].includes(role) && req.user.role === 'admin') {
      user.role = role;
    }
    if (password) user.passwordHash = await bcrypt.hash(password, 12);
    if (accommodations) {
      user.accommodations = normalizeAccommodations({
        ...normalizeAccommodations(user.accommodations),
        ...accommodations
      });
    }
    user.updatedAt = new Date().toISOString();

    const updated = await store.replaceUser(user);
    res.json({ user: toResponse(updated) });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete a user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account here' });
    }
    await store.deleteUser(id, req.user.coach);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/* ---------------- coach notes on a student ---------------- */

// Add a note
router.post('/:id/notes', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Note text is required' });
    }

    const user = await store.getUserById(req.params.id, req.user.coach);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.notes = user.notes || [];
    const note = {
      id: uuidv4(),
      text: String(text).trim(),
      author: req.user.username,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    user.notes.unshift(note);
    user.updatedAt = new Date().toISOString();

    await store.replaceUser(user);
    res.status(201).json({ note, user: toResponse(user) });
  } catch (error) {
    console.error('Add note error:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Edit a note
router.put('/:id/notes/:noteId', async (req, res) => {
  try {
    const { text } = req.body;
    const user = await store.getUserById(req.params.id, req.user.coach);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const note = (user.notes || []).find((n) => n.id === req.params.noteId);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    note.text = String(text || '').trim();
    note.updatedAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();

    await store.replaceUser(user);
    res.json({ note, user: toResponse(user) });
  } catch (error) {
    console.error('Edit note error:', error);
    res.status(500).json({ error: 'Failed to edit note' });
  }
});

// Delete a note
router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    const user = await store.getUserById(req.params.id, req.user.coach);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.notes = (user.notes || []).filter((n) => n.id !== req.params.noteId);
    user.updatedAt = new Date().toISOString();

    await store.replaceUser(user);
    res.json({ user: toResponse(user) });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
