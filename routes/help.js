const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Request help (attributed to the acting student when provided)
router.post('/', async (req, res) => {
  try {
    const { transactionId, screenNumber, context, studentId, studentName, date: clientDate } =
      req.body;

    let userId = req.user.id;
    let username = req.user.username;
    if (studentId) {
      userId = studentId;
      username = studentName || username;
      const student = await store.getUserById(studentId, req.user.coach);
      if (student) username = student.displayName || student.username;
    } else if (studentName) {
      username = studentName;
    }

    const helpRequest = {
      id: uuidv4(),
      type: 'helpRequest',
      coach: req.user.coach,
      userId,
      username,
      transactionId: transactionId || null,
      requestedAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedBy: null,
      screenNumber: screenNumber || null,
      context: context || {},
      notes: '',
      date:
        clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)
          ? clientDate
          : new Date().toISOString().split('T')[0]
    };

    await store.createHelpRequest(helpRequest);
    res.status(201).json({ helpRequest });
  } catch (error) {
    console.error('Create help request error:', error);
    res.status(500).json({ error: 'Failed to create help request' });
  }
});

// Get pending help requests (coach only)
router.get('/pending', requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const helpRequests = await store.listPendingHelpRequests(req.user.coach);
    res.json({ helpRequests });
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ error: 'Failed to fetch help requests' });
  }
});

// Resolve help request (coach only)
router.put('/:id/resolve', requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const helpRequest = await store.getHelpRequest(id, req.user.coach);
    if (!helpRequest) {
      return res.status(404).json({ error: 'Help request not found' });
    }

    helpRequest.resolvedAt = new Date().toISOString();
    helpRequest.resolvedBy = req.user.id;
    helpRequest.notes = notes || '';

    const updated = await store.replaceHelpRequest(helpRequest);
    res.json({ helpRequest: updated });
  } catch (error) {
    console.error('Resolve help request error:', error);
    res.status(500).json({ error: 'Failed to resolve help request' });
  }
});

module.exports = router;
