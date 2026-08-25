/**
 * Per-day stats document helpers.
 *
 * One dailyTotal doc per coach per day; per-student counters live in
 * userStats keyed by student id. The dashboard aggregates these docs over
 * today / month / year ranges — add a new counter here and it flows through
 * automatically (aggregation sums any numeric field).
 */

function blankUserStats(username) {
  return {
    username,
    transactions: 0,
    moneyProcessed: 0,
    itemsSold: 0,
    // Change quiz
    correctChangeAttempts: 0,
    incorrectChangeAttempts: 0,
    firstTryCorrect: 0,
    // Help / supports
    helpRequests: 0,
    // Cart corrections (times an item was removed or reduced)
    cartRemovals: 0,
    // Login tracking (see events route)
    loginAttempts: 0,
    loginSuccesses: 0,
    loginFailures: 0,
    loginMethods: { tap: 0, type: 0, pin: 0 },
    // Which payment input they actually used
    inputMethods: { bills: 0, keypad: 0 },
    // Time from first item to finished transaction (seconds, summed)
    durationSecondsTotal: 0
  };
}

function blankDailyTotal(coach, date) {
  return {
    id: `daily-${coach}-${date}`,
    type: 'dailyTotal',
    coach,
    date,
    totalTransactions: 0,
    totalMoneyProcessed: 0,
    totalItemsSold: 0,
    userStats: {},
    itemBreakdown: {},
    lastUpdated: new Date().toISOString()
  };
}

function ensureUserStats(dailyTotal, userId, username) {
  if (!dailyTotal.userStats[userId]) {
    dailyTotal.userStats[userId] = blankUserStats(username);
  }
  const stats = dailyTotal.userStats[userId];
  // Older docs may predate newer counters — backfill from the blank template.
  const blank = blankUserStats(username);
  for (const key of Object.keys(blank)) {
    if (stats[key] === undefined) stats[key] = blank[key];
  }
  if (username) stats.username = username;
  return stats;
}

function applyTransactionToDailyTotal(dailyTotal, txn) {
  const items = (txn.cartItems || []).reduce((sum, item) => sum + (item.quantity || 0), 0);

  dailyTotal.totalTransactions += 1;
  dailyTotal.totalMoneyProcessed += txn.totalCost || 0;
  dailyTotal.totalItemsSold += items;

  const stats = ensureUserStats(dailyTotal, txn.userId, txn.username);
  stats.transactions += 1;
  stats.moneyProcessed += txn.totalCost || 0;
  stats.itemsSold += items;

  if (txn.changeQuizResult === 'correct') {
    stats.correctChangeAttempts += 1;
    if (!txn.changeQuizAttempts) stats.firstTryCorrect += 1;
  }
  // changeQuizAttempts counts wrong picks made along the way
  stats.incorrectChangeAttempts += txn.changeQuizAttempts || 0;

  if (txn.helpRequested) stats.helpRequests += 1;
  stats.cartRemovals += txn.cartRemovals || 0;

  if (txn.inputMethod === 'bills' || txn.inputMethod === 'keypad') {
    stats.inputMethods[txn.inputMethod] = (stats.inputMethods[txn.inputMethod] || 0) + 1;
  }
  if (txn.durationSeconds) {
    stats.durationSecondsTotal += Math.max(0, Math.round(txn.durationSeconds));
  }

  (txn.cartItems || []).forEach((item) => {
    const name = item.name || 'unknown';
    if (!dailyTotal.itemBreakdown[name]) {
      dailyTotal.itemBreakdown[name] = { quantity: 0, revenue: 0 };
    }
    dailyTotal.itemBreakdown[name].quantity += item.quantity || 0;
    dailyTotal.itemBreakdown[name].revenue += item.totalCost || 0;
  });

  dailyTotal.lastUpdated = new Date().toISOString();
  return dailyTotal;
}

function applyLoginEventToDailyTotal(dailyTotal, { userId, username, success, method }) {
  const stats = ensureUserStats(dailyTotal, userId, username);
  stats.loginAttempts += 1;
  if (success) {
    stats.loginSuccesses += 1;
    if (method && stats.loginMethods[method] !== undefined) {
      stats.loginMethods[method] += 1;
    }
  } else {
    stats.loginFailures += 1;
  }
  dailyTotal.lastUpdated = new Date().toISOString();
  return dailyTotal;
}

/**
 * Sum a list of dailyTotal docs into one aggregate of the same shape.
 * Recursively sums numeric fields so newly added counters are included.
 */
function aggregateDailyTotals(docs, label) {
  const sumInto = (target, source) => {
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === 'number') {
        target[key] = (target[key] || 0) + value;
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {};
        sumInto(target[key], value);
      } else if (typeof value === 'string' && target[key] === undefined) {
        target[key] = value; // keep usernames etc.
      }
    }
  };

  const agg = {
    label: label || '',
    days: docs.length,
    totalTransactions: 0,
    totalMoneyProcessed: 0,
    totalItemsSold: 0,
    userStats: {},
    itemBreakdown: {}
  };

  for (const doc of docs) {
    agg.totalTransactions += doc.totalTransactions || 0;
    agg.totalMoneyProcessed += doc.totalMoneyProcessed || 0;
    agg.totalItemsSold += doc.totalItemsSold || 0;
    if (doc.userStats) sumInto(agg.userStats, doc.userStats);
    if (doc.itemBreakdown) sumInto(agg.itemBreakdown, doc.itemBreakdown);
  }

  return agg;
}

module.exports = {
  blankUserStats,
  blankDailyTotal,
  ensureUserStats,
  applyTransactionToDailyTotal,
  applyLoginEventToDailyTotal,
  aggregateDailyTotals
};
