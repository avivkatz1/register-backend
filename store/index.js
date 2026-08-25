/**
 * Data store selector.
 *
 * Uses Azure Cosmos DB when credentials are configured, otherwise falls back to
 * a local JSON-file store (great for development and offline classroom use).
 * Force a provider with DB_PROVIDER=local or DB_PROVIDER=cosmos.
 */
const hasCosmosCreds = !!(process.env.COSMOS_DB_ENDPOINT && process.env.COSMOS_DB_KEY);
const requested = (process.env.DB_PROVIDER || '').toLowerCase();

let store;
if (requested === 'local' || (!hasCosmosCreds && requested !== 'cosmos')) {
  if (!hasCosmosCreds && requested !== 'local') {
    console.log('Cosmos DB credentials not set — using local JSON store.');
  }
  store = require('./localStore');
} else {
  store = require('./cosmosStore');
}

module.exports = store;
