const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getContainer } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Create transaction
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      cartItems,
      totalCost,
      totalGiven,
      billsGiven,
      changeAmount,
      inputMethod,
      changeQuizResult,
      changeQuizAttempts,
      helpRequested
    } = req.body;

    const container = getContainer('transactions');
    const dailyContainer = getContainer('dailyTotals');

    const transaction = {
      id: uuidv4(),
      type: 'transaction',
      userId: req.user.id,
      username: req.user.username,
      cartItems: cartItems || [],
      totalCost: totalCost || 0,
      totalGiven: totalGiven || 0,
      billsGiven: billsGiven || [],
      changeAmount: changeAmount || 0,
      inputMethod: inputMethod || null,
      changeQuizResult: changeQuizResult || null,
      changeQuizAttempts: changeQuizAttempts || 0,
      helpRequested: helpRequested || false,
      helpRequestedAt: helpRequested ? new Date().toISOString() : null,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0]
    };

    await container.items.create(transaction);

    // Update daily totals
    await updateDailyTotals(dailyContainer, transaction);

    res.status(201).json({ transaction });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Get my transactions
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    const container = getContainer('transactions');

    const { resources: transactions } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.userId = @userId ORDER BY c.timestamp DESC OFFSET @offset LIMIT @limit',
        parameters: [
          { name: '@userId', value: req.user.id },
          { name: '@offset', value: parseInt(offset) },
          { name: '@limit', value: parseInt(limit) }
        ]
      })
      .fetchAll();

    res.json({ transactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get all transactions (admin only)
router.get('/', authenticateToken, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { limit = 50, offset = 0, date } = req.query;
    const container = getContainer('transactions');

    let query = 'SELECT * FROM c ORDER BY c.timestamp DESC OFFSET @offset LIMIT @limit';
    const parameters = [
      { name: '@offset', value: parseInt(offset) },
      { name: '@limit', value: parseInt(limit) }
    ];

    if (date) {
      query = 'SELECT * FROM c WHERE c.date = @date ORDER BY c.timestamp DESC OFFSET @offset LIMIT @limit';
      parameters.push({ name: '@date', value: date });
    }

    const { resources: transactions } = await container.items
      .query({ query, parameters })
      .fetchAll();

    res.json({ transactions });
  } catch (error) {
    console.error('Get all transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Helper function to update daily totals
async function updateDailyTotals(container, transaction) {
  try {
    const dailyId = `daily-${transaction.date}`;
    let dailyTotal;

    try {
      const { resource } = await container.item(dailyId, transaction.date).read();
      dailyTotal = resource;
    } catch (err) {
      // Create new daily total if it doesn't exist
      dailyTotal = {
        id: dailyId,
        type: 'dailyTotal',
        date: transaction.date,
        totalTransactions: 0,
        totalMoneyProcessed: 0,
        totalItemsSold: 0,
        userStats: {},
        itemBreakdown: {},
        lastUpdated: new Date().toISOString()
      };
    }

    // Update totals
    dailyTotal.totalTransactions += 1;
    dailyTotal.totalMoneyProcessed += transaction.totalCost;
    dailyTotal.totalItemsSold += transaction.cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

    // Update user stats
    if (!dailyTotal.userStats[transaction.userId]) {
      dailyTotal.userStats[transaction.userId] = {
        username: transaction.username,
        transactions: 0,
        moneyProcessed: 0,
        itemsSold: 0,
        correctChangeAttempts: 0,
        incorrectChangeAttempts: 0,
        helpRequests: 0
      };
    }

    const userStat = dailyTotal.userStats[transaction.userId];
    userStat.transactions += 1;
    userStat.moneyProcessed += transaction.totalCost;
    userStat.itemsSold += transaction.cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

    if (transaction.changeQuizResult === 'correct') {
      userStat.correctChangeAttempts += 1;
    } else if (transaction.changeQuizResult === 'incorrect') {
      userStat.incorrectChangeAttempts += 1;
    }

    if (transaction.helpRequested) {
      userStat.helpRequests += 1;
    }

    // Update item breakdown
    transaction.cartItems.forEach(item => {
      const itemName = item.name || 'unknown';
      if (!dailyTotal.itemBreakdown[itemName]) {
        dailyTotal.itemBreakdown[itemName] = {
          quantity: 0,
          revenue: 0
        };
      }
      dailyTotal.itemBreakdown[itemName].quantity += item.quantity || 0;
      dailyTotal.itemBreakdown[itemName].revenue += item.totalCost || 0;
    });

    dailyTotal.lastUpdated = new Date().toISOString();

    // Upsert daily total
    await container.items.upsert(dailyTotal);
  } catch (error) {
    console.error('Update daily totals error:', error);
    // Don't throw - allow transaction to succeed even if daily total update fails
  }
}

module.exports = router;
