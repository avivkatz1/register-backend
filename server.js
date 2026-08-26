require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const store = require('./store');

const app = express();
const PORT = process.env.PORT || 3001;

// Behind Azure App Service / proxies
app.set('trust proxy', 1);

// Middleware (limit raised for menu-item photos sent as data URLs)
app.use(express.json({ limit: '1mb' }));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  })
);

// Rate limiting (configurable so a busy classroom on one IP isn't locked out)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '600', 10),
  message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
  message: 'Too many login attempts, please try again later.'
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/users', require('./routes/users'));
app.use('/api/daily-totals', require('./routes/dailyTotals'));
app.use('/api/help', require('./routes/help'));
app.use('/api/events', require('./routes/events'));
app.use('/api/menu', require('./routes/menu'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', provider: store.provider, timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server after the store is ready
async function start() {
  try {
    await store.init();
  } catch (err) {
    console.error('Store initialization failed:', err.message);
    console.error('Continuing to serve; requests may fail until the database is reachable.');
  }
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (db: ${store.provider})`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
