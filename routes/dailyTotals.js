const express = require('express');
const router = express.Router();
const { getContainer } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

router.use(authenticateToken);

// Get today's totals
router.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const container = getContainer('dailyTotals');

    try {
      const { resource: dailyTotal } = await container.item(`daily-${today}`, today).read();
      res.json({ dailyTotal });
    } catch (error) {
      // Return empty totals if not found
      res.json({
        dailyTotal: {
          date: today,
          totalTransactions: 0,
          totalMoneyProcessed: 0,
          totalItemsSold: 0,
          userStats: {},
          itemBreakdown: {}
        }
      });
    }
  } catch (error) {
    console.error('Get today totals error:', error);
    res.status(500).json({ error: 'Failed to fetch today\'s totals' });
  }
});

// Get specific date totals
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const container = getContainer('dailyTotals');

    try {
      const { resource: dailyTotal } = await container.item(`daily-${date}`, date).read();
      res.json({ dailyTotal });
    } catch (error) {
      res.json({
        dailyTotal: {
          date,
          totalTransactions: 0,
          totalMoneyProcessed: 0,
          totalItemsSold: 0,
          userStats: {},
          itemBreakdown: {}
        }
      });
    }
  } catch (error) {
    console.error('Get date totals error:', error);
    res.status(500).json({ error: 'Failed to fetch daily totals' });
  }
});

// Get date range totals
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const container = getContainer('dailyTotals');

    const { resources: dailyTotals } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.date >= @startDate AND c.date <= @endDate ORDER BY c.date',
        parameters: [
          { name: '@startDate', value: startDate },
          { name: '@endDate', value: endDate }
        ]
      })
      .fetchAll();

    res.json({ dailyTotals });
  } catch (error) {
    console.error('Get date range totals error:', error);
    res.status(500).json({ error: 'Failed to fetch date range totals' });
  }
});

module.exports = router;
