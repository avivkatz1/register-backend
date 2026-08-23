const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getContainer } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName, role = 'student' } = req.body;

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

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = {
      id: uuidv4(),
      type: 'user',
      username,
      email,
      passwordHash,
      displayName: displayName || username,
      role,
      accommodations: {
        registerKeyboard: ['bills', 'keypad'],
        buttonSize: false,
        minimizeChoices: 0
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await container.items.create(user);

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Remove password hash from response
    const { passwordHash, ...userResponse } = user;

    res.status(201).json({ user: userResponse, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const container = getContainer('users');

    const { resources: users } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.username = @username',
        parameters: [{ name: '@username', value: username }]
      })
      .fetchAll();

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Remove password hash from response
    const { passwordHash, ...userResponse } = user;

    res.json({ user: userResponse, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const container = getContainer('users');

    const { resource: user } = await container.item(req.user.id, 'user').read();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { passwordHash, ...userResponse } = user;
    res.json({ user: userResponse });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user profile
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { displayName, email, accommodations } = req.body;
    const container = getContainer('users');

    const { resource: user } = await container.item(req.user.id, 'user').read();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update fields
    if (displayName) user.displayName = displayName;
    if (email) user.email = email;
    if (accommodations) user.accommodations = { ...user.accommodations, ...accommodations };
    user.updatedAt = new Date().toISOString();

    const { resource: updatedUser } = await container.item(req.user.id, 'user').replace(user);

    const { passwordHash, ...userResponse } = updatedUser;
    res.json({ user: userResponse });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

module.exports = router;
