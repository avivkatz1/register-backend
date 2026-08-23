# Backend Quick Start Guide

## Prerequisites

- Node.js 16+ installed
- Azure account with Cosmos DB access
- Text editor

## Step 1: Install Dependencies

```bash
cd register-backend
npm install
```

## Step 2: Configure Environment

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and fill in your Azure Cosmos DB credentials:

```env
# Get these from Azure Portal > Cosmos DB > Keys
COSMOS_DB_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_DB_KEY=your-primary-key-here
COSMOS_DB_DATABASE=register-db

# Generate a random secret (e.g., use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=your-super-secret-key-min-32-characters
JWT_EXPIRES_IN=24h

# Server config
PORT=3001
NODE_ENV=development

# Add your frontend URL
ALLOWED_ORIGINS=http://localhost:3000
```

## Step 3: Start the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on http://localhost:3001

## Step 4: Test the API

Health check:
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-08-23T..."}
```

## Step 5: Create First Admin User

Use an API client like Postman, Insomnia, or curl:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@school.edu",
    "password": "SecurePassword123!",
    "displayName": "Administrator",
    "role": "admin"
  }'
```

Save the returned `token` - you'll need it for authenticated requests.

## Step 6: Configure Frontend

In your frontend directory (`register/`), create or edit `.env.local`:

```env
REACT_APP_API_URL=http://localhost:3001
```

## Common Commands

```bash
# Install dependencies
npm install

# Start development server (auto-reload)
npm run dev

# Start production server
npm start

# Check for errors
npm test
```

## Troubleshooting

### Port 3001 already in use
Change the PORT in `.env` to another value (e.g., 3002)

### Cosmos DB connection failed
- Verify endpoint and key in `.env`
- Check Azure portal - ensure Cosmos DB is running
- Check firewall rules - allow access from your IP

### CORS errors from frontend
- Add your frontend URL to `ALLOWED_ORIGINS` in `.env`
- Restart the backend server after changes

### Database/containers not created
- The server automatically creates them on first run
- Check console logs for any errors
- Verify you have write permissions in Cosmos DB

## Next Steps

1. Create test users (students, teachers)
2. Test authentication flow
3. Complete a transaction from the frontend
4. Check admin dashboard
5. Deploy to Azure App Service (see main README.md)

## API Documentation

Full API documentation is available in the main README.md file.

Quick reference:
- POST /api/auth/register - Register user
- POST /api/auth/login - Login
- POST /api/transactions - Create transaction
- GET /api/daily-totals/today - Get today's stats
- GET /api/help/pending - Get help requests (admin)

All authenticated endpoints require:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Support

For issues or questions, check:
1. Console logs for detailed error messages
2. IMPLEMENTATION_SUMMARY.md for troubleshooting section
3. Azure Cosmos DB metrics in Azure Portal
