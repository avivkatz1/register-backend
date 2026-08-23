const { CosmosClient } = require('@azure/cosmos');

const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
const databaseId = process.env.COSMOS_DB_DATABASE || 'register-db';

if (!endpoint || !key) {
  console.error('Cosmos DB credentials not configured. Please set COSMOS_DB_ENDPOINT and COSMOS_DB_KEY.');
}

const client = new CosmosClient({ endpoint, key });

// Container references
const containersConfig = {
  users: {
    id: 'users',
    partitionKey: '/type'
  },
  transactions: {
    id: 'transactions',
    partitionKey: '/date'
  },
  dailyTotals: {
    id: 'dailyTotals',
    partitionKey: '/date'
  },
  helpRequests: {
    id: 'helpRequests',
    partitionKey: '/date'
  }
};

// Initialize database and containers
async function initializeDatabase() {
  try {
    const { database } = await client.databases.createIfNotExists({ id: databaseId });
    console.log(`Database '${databaseId}' ready`);

    // Create containers
    for (const [name, config] of Object.entries(containersConfig)) {
      await database.containers.createIfNotExists({
        id: config.id,
        partitionKey: { paths: [config.partitionKey] }
      });
      console.log(`Container '${config.id}' ready`);
    }

    return database;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Get container reference
function getContainer(containerName) {
  return client.database(databaseId).container(containerName);
}

module.exports = {
  client,
  initializeDatabase,
  getContainer,
  containersConfig
};
