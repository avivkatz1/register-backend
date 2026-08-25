const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { blankDailyTotal, applyTransactionToDailyTotal } = require('../shared/stats');

// Create transaction.
// The device is signed in as the coach; the acting student is passed in the
// body (studentId/studentName) and the transaction is attributed to them.
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
      helpRequested,
      cartRemovals,
      durationSeconds,
      studentId,
      studentName,
      timestamp,
      date,
      clientId
    } = req.body;

    // Idempotency: the offline queue may retry a transaction that actually
    // reached us — never record the same clientId twice.
    if (clientId) {
      const existing = await store.findTransactionByClientId(req.user.coach, clientId);
      if (existing) {
        return res.status(200).json({ transaction: existing, duplicate: true });
      }
    }

    // Resolve who this transaction belongs to
    let userId = req.user.id;
    let username = req.user.username;
    if (studentId) {
      const student = await store.getUserById(studentId, req.user.coach);
      if (student) {
        userId = student.id;
        username = student.displayName || student.username;
      } else if (studentName) {
        // Student may have been deleted; keep the name for the record
        userId = studentId;
        username = studentName;
      }
    } else if (studentName) {
      // No roster id (e.g. practice-mode transaction synced later):
      // group by the typed name, same key the login-events route uses
      userId = `name-${String(studentName).toLowerCase()}`;
      username = studentName;
    }

    // Allow client timestamps (offline queue sync) but never trust the future
    const now = new Date().toISOString();
    const ts = timestamp && timestamp <= now ? timestamp : now;

    const transaction = {
      id: uuidv4(),
      type: 'transaction',
      clientId: clientId || null,
      coach: req.user.coach,
      userId,
      username,
      submittedBy: req.user.id,
      cartItems: cartItems || [],
      totalCost: totalCost || 0,
      totalGiven: totalGiven || 0,
      billsGiven: billsGiven || [],
      changeAmount: changeAmount || 0,
      inputMethod: inputMethod || null,
      changeQuizResult: changeQuizResult || null,
      changeQuizAttempts: changeQuizAttempts || 0,
      helpRequested: helpRequested || false,
      helpRequestedAt: helpRequested ? ts : null,
      cartRemovals: cartRemovals || 0,
      durationSeconds: durationSeconds || 0,
      timestamp: ts,
      date: date || ts.split('T')[0]
    };

    await store.createTransaction(transaction);

    // Update daily totals (best-effort; the transaction itself is the record)
    try {
      const id = `daily-${transaction.coach}-${transaction.date}`;
      const dailyTotal =
        (await store.getDailyTotal(id, transaction.coach)) ||
        blankDailyTotal(transaction.coach, transaction.date);
      applyTransactionToDailyTotal(dailyTotal, transaction);
      await store.upsertDailyTotal(dailyTotal);
    } catch (err) {
      console.error('Update daily totals error:', err);
    }

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
    const transactions = await store.listTransactionsByUser(req.user.coach, req.user.id, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
    res.json({ transactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get all transactions for this coach (optionally filtered by date / student)
router.get('/', authenticateToken, requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { limit = 50, offset = 0, date, studentId } = req.query;
    const transactions = await store.listTransactionsByCoach(req.user.coach, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      date,
      studentId
    });
    res.json({ transactions });
  } catch (error) {
    console.error('Get all transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = router;
