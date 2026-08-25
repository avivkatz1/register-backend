const express = require('express');
const router = express.Router();
const store = require('../store');
const { authenticateToken } = require('../middleware/auth');
const { blankDailyTotal, applyLoginEventToDailyTotal } = require('../shared/stats');

router.use(authenticateToken);

// Record a student login attempt (success or failure).
// Lets the coach see how independently each student signs in and when a
// student is ready to move up the login ladder (tap → type → pin).
router.post('/login', async (req, res) => {
  try {
    const { studentId, studentName, success, method, date: clientDate } = req.body;

    if (!studentId && !studentName) {
      return res.status(400).json({ error: 'studentId or studentName required' });
    }

    let userId = studentId;
    let username = studentName;
    if (studentId) {
      const student = await store.getUserById(studentId, req.user.coach);
      if (student) username = student.displayName || student.username;
    }
    if (!userId) userId = `name-${String(studentName).toLowerCase()}`;

    // Prefer the device's local calendar date so evening events don't roll
    // into tomorrow's stats (server clocks are usually UTC)
    const date =
      clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)
        ? clientDate
        : new Date().toISOString().split('T')[0];
    const id = `daily-${req.user.coach}-${date}`;
    const dailyTotal =
      (await store.getDailyTotal(id, req.user.coach)) || blankDailyTotal(req.user.coach, date);

    applyLoginEventToDailyTotal(dailyTotal, {
      userId,
      username,
      success: !!success,
      method: ['tap', 'type', 'pin'].includes(method) ? method : null
    });

    await store.upsertDailyTotal(dailyTotal);
    res.status(201).json({ recorded: true });
  } catch (error) {
    console.error('Login event error:', error);
    res.status(500).json({ error: 'Failed to record login event' });
  }
});

module.exports = router;
