const express = require('express');
const router = express.Router();
const store = require('../store');
const { authenticateToken } = require('../middleware/auth');
const { blankDailyTotal, aggregateDailyTotals } = require('../shared/stats');

router.use(authenticateToken);

function emptyTotal(date) {
  const t = blankDailyTotal('none', date);
  delete t.id;
  delete t.coach;
  delete t.type;
  return t;
}

// Dashboard summary: today / this month / this year, aggregated.
// The client passes its local date (?date=YYYY-MM-DD) so "today" matches the
// classroom clock, not the server's timezone. Must be declared before /:date.
router.get('/summary', async (req, res) => {
  try {
    const today =
      req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : new Date().toISOString().split('T')[0];

    const year = today.slice(0, 4);
    const month = today.slice(0, 7);

    const yearDocs = await store.listDailyTotalsRange(
      req.user.coach,
      `${year}-01-01`,
      `${year}-12-31`
    );
    const monthDocs = yearDocs.filter((d) => d.date && d.date.startsWith(month));
    const todayDocs = yearDocs.filter((d) => d.date === today);

    res.json({
      date: today,
      today: aggregateDailyTotals(todayDocs, 'Today'),
      month: aggregateDailyTotals(monthDocs, 'This Month'),
      year: aggregateDailyTotals(yearDocs, 'This Year')
    });
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Get today's totals
router.get('/today', async (req, res) => {
  try {
    const today =
      req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : new Date().toISOString().split('T')[0];
    const dailyTotal = await store.getDailyTotal(`daily-${req.user.coach}-${today}`, req.user.coach);
    res.json({ dailyTotal: dailyTotal || emptyTotal(today) });
  } catch (error) {
    console.error('Get today totals error:', error);
    res.status(500).json({ error: "Failed to fetch today's totals" });
  }
});

// Get date range totals
router.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    const dailyTotals = await store.listDailyTotalsRange(req.user.coach, startDate, endDate);
    res.json({ dailyTotals });
  } catch (error) {
    console.error('Get date range totals error:', error);
    res.status(500).json({ error: 'Failed to fetch date range totals' });
  }
});

// Get specific date totals (keep last — catches /:date)
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const dailyTotal = await store.getDailyTotal(`daily-${req.user.coach}-${date}`, req.user.coach);
    res.json({ dailyTotal: dailyTotal || emptyTotal(date) });
  } catch (error) {
    console.error('Get date totals error:', error);
    res.status(500).json({ error: 'Failed to fetch daily totals' });
  }
});

module.exports = router;
