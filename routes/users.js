const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { getContainer } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All routes require admin role
router.use(authenticateToken, requireRole('admin'));

// Get all users
router.get('/', async (req, res) => {
  try {
    const container = getContainer('users');

    const { resources: users } = await container.items
      .query('SELECT * FROM c WHERE c.type = "user"')
      .fetchAll();

    // Remove password hashes
    const usersResponse = users.map(({ passwordHash, ...user }) => user);

    res.json({ users: usersResponse });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user
router.post('/', async (req, res) => {
  try {
    const { username, email, password, displayName, role, accommodations } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const container = getContainer('users');

    // Check if user exists
    const { resources: existingUsers } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.username = @username OR c.email = @email',
        parameters: [
          { name: '@username', value: username },
          { name: '@email', value: email }
        ]
      })
      .fetchAll();

    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
      id: uuidv4(),
      type: 'user',
      username,
      email,
      passwordHash,
      displayName: displayName || username,
      role: role || 'student',
      accommodations: accommodations || {
        registerKeyboard: ['bills', 'keypad'],
        buttonSize: false,
        minimizeChoices: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await container.items.create(user);

    const { passwordHash: _, ...userResponse } = user;
    res.status(201).json({ user: userResponse });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, displayName, role, accommodations } = req.body;

    const container = getContainer('users');

    const { resource: user } = await container.item(id, 'user').read();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update fields
    if (username) user.username = username;
    if (email) user.email = email;
    if (displayName) user.displayName = displayName;
    if (role) user.role = role;
    if (accommodations) user.accommodations = { ...user.accommodations, ...accommodations };
    user.updatedAt = new Date().toISOString();

    const { resource: updatedUser } = await container.item(id, 'user').replace(user);

    const { passwordHash, ...userResponse } = updatedUser;
    res.json({ user: userResponse });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const container = getContainer('users');

    await container.item(id, 'user').delete();

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
