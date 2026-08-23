const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getContainer } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken);

// Request help
router.post('/', async (req, res) => {
  try {
    const { transactionId, screenNumber, context } = req.body;

    const container = getContainer('helpRequests');

    const helpRequest = {
      id: uuidv4(),
      type: 'helpRequest',
      userId: req.user.id,
      username: req.user.username,
      transactionId: transactionId || null,
      requestedAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedBy: null,
      screenNumber: screenNumber || null,
      context: context || {},
      notes: '',
      date: new Date().toISOString().split('T')[0]
    };

    await container.items.create(helpRequest);

    res.status(201).json({ helpRequest });
  } catch (error) {
    console.error('Create help request error:', error);
    res.status(500).json({ error: 'Failed to create help request' });
  }
});

// Get pending help requests (admin/teacher only)
router.get('/pending', requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const container = getContainer('helpRequests');

    const { resources: helpRequests } = await container.items
      .query('SELECT * FROM c WHERE c.resolvedAt = null ORDER BY c.requestedAt')
      .fetchAll();

    res.json({ helpRequests });
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ error: 'Failed to fetch help requests' });
  }
});

// Resolve help request (admin/teacher only)
router.put('/:id/resolve', requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const container = getContainer('helpRequests');

    // Get the help request first to determine partition key
    const { resources: requests } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }]
      })
      .fetchAll();

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Help request not found' });
    }

    const helpRequest = requests[0];
    helpRequest.resolvedAt = new Date().toISOString();
    helpRequest.resolvedBy = req.user.id;
    helpRequest.notes = notes || '';

    const { resource: updated } = await container
      .item(id, helpRequest.date)
      .replace(helpRequest);

    res.json({ helpRequest: updated });
  } catch (error) {
    console.error('Resolve help request error:', error);
    res.status(500).json({ error: 'Failed to resolve help request' });
  }
});

module.exports = router;
