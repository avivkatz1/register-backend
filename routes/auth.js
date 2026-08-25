const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { authenticateToken } = require('../middleware/auth');
const { normalizeAccommodations } = require('../shared/accommodations');

const DEFAULT_COACH_PIN = '0218';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, coach: user.coach },
    process.env.JWT_SECRET,
    // A classroom iPad shouldn't silently stop recording mid-week; the
    // frontend still forces re-login the moment a 401 comes back.
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function toResponse(user) {
  if (!user) return user;
  const { passwordHash, ...rest } = user;
  rest.accommodations = normalizeAccommodations(rest.accommodations);
  return rest;
}

// Register a new coach account (public endpoint)
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Username must not clash with another login-capable account (students
    // without passwords don't block a coach name); email must be unique.
    const sameName = await store.findUsersByUsername(username);
    if (sameName.some((u) => u.passwordHash)) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    const emailConflict = await store.findUserConflict({ username: '', email });
    if (emailConflict) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
      id: uuidv4(),
      type: 'user',
      coach: uuidv4(), // each coach account gets its own partition
      username,
      email,
      passwordHash,
      displayName: displayName || username,
      role: 'admin',
      coachPin: DEFAULT_COACH_PIN,
      accommodations: normalizeAccommodations(null),
      notes: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await store.createUser(user);

    res.status(201).json({ user: toResponse(user), token: signToken(user) });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login (coach accounts — students sign in on-device through the coach session)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Several accounts can share a username across coaches (e.g. a
    // password-less student named like a coach) — only password-bearing
    // accounts can log in, and we check each candidate.
    const candidates = (await store.findUsersByUsername(username)).filter(
      (u) => u.passwordHash
    );

    let user = null;
    for (const candidate of candidates) {
      if (await bcrypt.compare(password, candidate.passwordHash)) {
        user = candidate;
        break;
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ user: toResponse(user), token: signToken(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await store.getUserById(req.user.id, req.user.coach);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: toResponse(user) });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update current user profile
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { displayName, email, accommodations, coachPin } = req.body;

    const user = await store.getUserById(req.user.id, req.user.coach);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (displayName) user.displayName = displayName;
    if (email) user.email = email;
    if (accommodations) {
      user.accommodations = normalizeAccommodations({
        ...user.accommodations,
        ...accommodations
      });
    }
    if (coachPin !== undefined && user.role === 'admin') {
      const pin = String(coachPin).replace(/\D/g, '');
      if (pin.length !== 4) {
        return res.status(400).json({ error: 'Coach PIN must be exactly 4 digits' });
      }
      user.coachPin = pin;
    }
    user.updatedAt = new Date().toISOString();

    const updated = await store.replaceUser(user);
    res.json({ user: toResponse(updated) });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;
