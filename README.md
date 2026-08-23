# Cash Register Backend API

Backend API for the educational cash register application using Azure Cosmos DB.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your Azure Cosmos DB credentials
   - Set a secure JWT secret

3. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login (returns JWT)
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update user profile

### Transactions
- `POST /api/transactions` - Create transaction
- `GET /api/transactions` - List transactions (admin only)
- `GET /api/transactions/me` - Get my transactions

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Daily Totals
- `GET /api/daily-totals` - Get totals for date range
- `GET /api/daily-totals/today` - Get today's totals
- `GET /api/daily-totals/:date` - Get specific date

### Help Requests
- `POST /api/help` - Request help
- `GET /api/help/pending` - Get pending requests
- `PUT /api/help/:id/resolve` - Mark as resolved

## Data Models

See the plan documentation for complete data model schemas.

## Deployment

For production deployment to Azure App Service, ensure:
1. Environment variables are set in Azure portal
2. CORS origins include your production frontend URL
3. Use HTTPS only
4. Enable rate limiting
