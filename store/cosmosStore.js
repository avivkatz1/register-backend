/**
 * Azure Cosmos DB data store.
 *
 * All documents live in the single 'register' container, partitioned by /coach,
 * discriminated by a `type` field ('user' | 'transaction' | 'dailyTotal' | 'helpRequest').
 */
const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE || 'register-db';

let client = null;

function getContainer() {
  if (!client) client = new CosmosClient({ endpoint, key });
  return client.database(databaseId).container('register');
}

async function init() {
  client = new CosmosClient({ endpoint, key });
  const { database } = await client.databases.createIfNotExists({ id: databaseId });
  await database.containers.createIfNotExists({
    id: 'register',
    partitionKey: { paths: ['/coach'] }
  });
  console.log(`Cosmos DB '${databaseId}' ready (container 'register')`);
}

async function queryAll(query, parameters) {
  const { resources } = await getContainer().items.query({ query, parameters }).fetchAll();
  return resources;
}

async function readItem(id, partitionKey) {
  try {
    const { resource } = await getContainer().item(id, partitionKey).read();
    return resource || undefined;
  } catch (err) {
    if (err.code === 404) return undefined;
    throw err;
  }
}

/* ---------------- users ---------------- */

async function createUser(user) {
  const { resource } = await getContainer().items.create(user);
  return resource;
}

async function findUserByUsername(username) {
  const users = await findUsersByUsername(username);
  return users[0];
}

async function findUsersByUsername(username) {
  return queryAll(
    'SELECT * FROM c WHERE c.type = "user" AND LOWER(c.username) = LOWER(@username)',
    [{ name: '@username', value: username }]
  );
}

async function findUserConflict({ coach, username, email }) {
  let query =
    'SELECT * FROM c WHERE c.type = "user" AND (LOWER(c.username) = LOWER(@username) OR (IS_DEFINED(c.email) AND c.email != null AND LOWER(c.email) = LOWER(@email)))';
  const parameters = [
    { name: '@username', value: username || '' },
    { name: '@email', value: email || '' }
  ];
  if (coach) {
    query += ' AND c.coach = @coach';
    parameters.push({ name: '@coach', value: coach });
  }
  const users = await queryAll(query, parameters);
  return users[0];
}

async function getUserById(id, coach) {
  return readItem(id, coach);
}

async function replaceUser(user) {
  const { resource } = await getContainer().item(user.id, user.coach).replace(user);
  return resource;
}

async function deleteUser(id, coach) {
  try {
    await getContainer().item(id, coach).delete();
  } catch (err) {
    if (err.code !== 404) throw err;
  }
}

async function listUsersByCoach(coach) {
  return queryAll('SELECT * FROM c WHERE c.coach = @coach AND c.type = "user"', [
    { name: '@coach', value: coach }
  ]);
}

/* ---------------- transactions ---------------- */

async function createTransaction(txn) {
  const { resource } = await getContainer().items.create(txn);
  return resource;
}

async function findTransactionByClientId(coach, clientId) {
  const txns = await queryAll(
    'SELECT * FROM c WHERE c.coach = @coach AND c.type = "transaction" AND c.clientId = @clientId',
    [
      { name: '@coach', value: coach },
      { name: '@clientId', value: clientId }
    ]
  );
  return txns[0];
}

async function listTransactionsByUser(coach, userId, { limit = 10, offset = 0 } = {}) {
  return queryAll(
    'SELECT * FROM c WHERE c.coach = @coach AND c.type = "transaction" AND c.userId = @userId ORDER BY c.timestamp DESC OFFSET @offset LIMIT @limit',
    [
      { name: '@coach', value: coach },
      { name: '@userId', value: userId },
      { name: '@offset', value: parseInt(offset, 10) || 0 },
      { name: '@limit', value: parseInt(limit, 10) || 10 }
    ]
  );
}

async function listTransactionsByCoach(coach, { limit = 50, offset = 0, date, studentId } = {}) {
  let query = 'SELECT * FROM c WHERE c.coach = @coach AND c.type = "transaction"';
  const parameters = [
    { name: '@coach', value: coach },
    { name: '@offset', value: parseInt(offset, 10) || 0 },
    { name: '@limit', value: parseInt(limit, 10) || 50 }
  ];
  if (date) {
    query += ' AND c.date = @date';
    parameters.push({ name: '@date', value: date });
  }
  if (studentId) {
    query += ' AND c.userId = @studentId';
    parameters.push({ name: '@studentId', value: studentId });
  }
  query += ' ORDER BY c.timestamp DESC OFFSET @offset LIMIT @limit';
  return queryAll(query, parameters);
}

/* ---------------- daily totals ---------------- */

async function getDailyTotal(id, coach) {
  return readItem(id, coach);
}

async function upsertDailyTotal(doc) {
  const { resource } = await getContainer().items.upsert(doc);
  return resource;
}

async function listDailyTotalsRange(coach, startDate, endDate) {
  return queryAll(
    'SELECT * FROM c WHERE c.coach = @coach AND c.type = "dailyTotal" AND c.date >= @startDate AND c.date <= @endDate ORDER BY c.date',
    [
      { name: '@coach', value: coach },
      { name: '@startDate', value: startDate },
      { name: '@endDate', value: endDate }
    ]
  );
}

/* ---------------- menu items ---------------- */

async function listMenuItems(coach) {
  // Sort in JS: Cosmos ORDER BY drops docs missing the property, and "order"
  // is a reserved word there anyway.
  const items = await queryAll(
    'SELECT * FROM c WHERE c.coach = @coach AND c.type = "menuItem"',
    [{ name: '@coach', value: coach }]
  );
  return items.sort((a, b) => (a.order || 0) - (b.order || 0));
}

async function createMenuItem(item) {
  const { resource } = await getContainer().items.create(item);
  return resource;
}

async function getMenuItem(id, coach) {
  return readItem(id, coach);
}

async function replaceMenuItem(item) {
  const { resource } = await getContainer().item(item.id, item.coach).replace(item);
  return resource;
}

async function deleteMenuItem(id, coach) {
  try {
    await getContainer().item(id, coach).delete();
  } catch (err) {
    if (err.code !== 404) throw err;
  }
}

/* ---------------- small meta docs (e.g. menu seeded marker) ---------------- */

async function getMetaDoc(id, coach) {
  return readItem(id, coach);
}

async function upsertMetaDoc(doc) {
  const { resource } = await getContainer().items.upsert(doc);
  return resource;
}

/* ---------------- help requests ---------------- */

async function createHelpRequest(doc) {
  const { resource } = await getContainer().items.create(doc);
  return resource;
}

async function listPendingHelpRequests(coach) {
  return queryAll(
    'SELECT * FROM c WHERE c.coach = @coach AND c.type = "helpRequest" AND (NOT IS_DEFINED(c.resolvedAt) OR c.resolvedAt = null) ORDER BY c.requestedAt',
    [{ name: '@coach', value: coach }]
  );
}

async function getHelpRequest(id, coach) {
  return readItem(id, coach);
}

async function replaceHelpRequest(doc) {
  const { resource } = await getContainer().item(doc.id, doc.coach).replace(doc);
  return resource;
}

module.exports = {
  provider: 'cosmos',
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
  listMenuItems,
  createMenuItem,
  getMenuItem,
  replaceMenuItem,
  deleteMenuItem,
  getMetaDoc,
  upsertMetaDoc,
  createHelpRequest,
  listPendingHelpRequests,
  getHelpRequest,
  replaceHelpRequest
};
