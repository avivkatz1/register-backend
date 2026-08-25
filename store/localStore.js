/**
 * Local JSON-file data store.
 *
 * Used automatically when Cosmos DB credentials are not configured (or when
 * DB_PROVIDER=local). Implements the same interface as cosmosStore so the
 * app can run fully offline / in local development with zero setup.
 *
 * Data lives in a single JSON file (default: ./data/local-db.json).
 * This is intended for a single-classroom scale, not high concurrency.
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE =
  process.env.LOCAL_DB_FILE || path.join(__dirname, '..', 'data', 'local-db.json');

let db = { users: [], transactions: [], dailyTotals: [], helpRequests: [] };
let saveTimer = null;

function load() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      db = {
        users: parsed.users || [],
        transactions: parsed.transactions || [],
        dailyTotals: parsed.dailyTotals || [],
        helpRequests: parsed.helpRequests || []
      };
    }
  } catch (err) {
    console.error('localStore: failed to read data file, starting empty:', err.message);
  }
}

function persist() {
  // Debounce writes a little; classroom scale doesn't need more.
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      const tmp = DATA_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
      fs.renameSync(tmp, DATA_FILE);
    } catch (err) {
      console.error('localStore: failed to write data file:', err.message);
    }
  }, 100);
}

const clone = (obj) => (obj === undefined ? undefined : JSON.parse(JSON.stringify(obj)));

async function init() {
  load();
  console.log(`Local JSON store ready (${DATA_FILE})`);
}

/* ---------------- users ---------------- */

async function createUser(user) {
  db.users.push(clone(user));
  persist();
  return clone(user);
}

async function findUserByUsername(username) {
  const lower = String(username).toLowerCase();
  return clone(db.users.find((u) => String(u.username).toLowerCase() === lower));
}

async function findUsersByUsername(username) {
  const lower = String(username).toLowerCase();
  return clone(db.users.filter((u) => String(u.username).toLowerCase() === lower));
}

async function findUserConflict({ coach, username, email }) {
  const lowerName = username ? String(username).toLowerCase() : null;
  const lowerEmail = email ? String(email).toLowerCase() : null;
  return clone(
    db.users.find((u) => {
      if (coach && u.coach !== coach) return false;
      const nameHit = lowerName && String(u.username).toLowerCase() === lowerName;
      const emailHit = lowerEmail && u.email && String(u.email).toLowerCase() === lowerEmail;
      return nameHit || emailHit;
    })
  );
}

async function getUserById(id, coach) {
  return clone(db.users.find((u) => u.id === id && (!coach || u.coach === coach)));
}

async function replaceUser(user) {
  const idx = db.users.findIndex((u) => u.id === user.id);
  if (idx === -1) throw new Error('User not found');
  db.users[idx] = clone(user);
  persist();
  return clone(user);
}

async function deleteUser(id, coach) {
  db.users = db.users.filter((u) => !(u.id === id && u.coach === coach));
  persist();
}

async function listUsersByCoach(coach) {
  return clone(db.users.filter((u) => u.coach === coach));
}

/* ---------------- transactions ---------------- */

async function createTransaction(txn) {
  db.transactions.push(clone(txn));
  persist();
  return clone(txn);
}

async function findTransactionByClientId(coach, clientId) {
  return clone(db.transactions.find((t) => t.coach === coach && t.clientId === clientId));
}

async function listTransactionsByUser(coach, userId, { limit = 10, offset = 0 } = {}) {
  return clone(
    db.transactions
      .filter((t) => t.coach === coach && t.userId === userId)
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .slice(offset, offset + limit)
  );
}

async function listTransactionsByCoach(coach, { limit = 50, offset = 0, date, studentId } = {}) {
  return clone(
    db.transactions
      .filter(
        (t) =>
          t.coach === coach &&
          (!date || t.date === date) &&
          (!studentId || t.userId === studentId)
      )
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .slice(offset, offset + limit)
  );
}

/* ---------------- daily totals ---------------- */

async function getDailyTotal(id, coach) {
  return clone(db.dailyTotals.find((d) => d.id === id && d.coach === coach));
}

async function upsertDailyTotal(doc) {
  const idx = db.dailyTotals.findIndex((d) => d.id === doc.id);
  if (idx === -1) db.dailyTotals.push(clone(doc));
  else db.dailyTotals[idx] = clone(doc);
  persist();
  return clone(doc);
}

async function listDailyTotalsRange(coach, startDate, endDate) {
  return clone(
    db.dailyTotals
      .filter((d) => d.coach === coach && d.date >= startDate && d.date <= endDate)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  );
}

/* ---------------- help requests ---------------- */

async function createHelpRequest(doc) {
  db.helpRequests.push(clone(doc));
  persist();
  return clone(doc);
}

async function listPendingHelpRequests(coach) {
  return clone(
    db.helpRequests
      .filter((h) => h.coach === coach && !h.resolvedAt)
      .sort((a, b) => (a.requestedAt < b.requestedAt ? -1 : 1))
  );
}

async function getHelpRequest(id, coach) {
  return clone(db.helpRequests.find((h) => h.id === id && h.coach === coach));
}

async function replaceHelpRequest(doc) {
  const idx = db.helpRequests.findIndex((h) => h.id === doc.id);
  if (idx === -1) throw new Error('Help request not found');
  db.helpRequests[idx] = clone(doc);
  persist();
  return clone(doc);
}

module.exports = {
  provider: 'local',
  init,
  createUser,
  findUserByUsername,
  findUsersByUsername,
  findUserConflict,
  getUserById,
  replaceUser,
  deleteUser,
  listUsersByCoach,
  createTransaction,
  findTransactionByClientId,
  listTransactionsByUser,
  listTransactionsByCoach,
  getDailyTotal,
  upsertDailyTotal,
  listDailyTotalsRange,
  createHelpRequest,
  listPendingHelpRequests,
  getHelpRequest,
  replaceHelpRequest
};
