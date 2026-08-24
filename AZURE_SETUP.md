# Azure Cosmos DB Setup Guide

This guide walks you through setting up Azure Cosmos DB for the cash register backend.

## Prerequisites

- Azure account (free tier available: https://azure.microsoft.com/free/)
- Azure CLI installed (optional but recommended)

## Step-by-Step Setup

### 1. Create Azure Cosmos DB Account

#### Option A: Using Azure Portal (Easiest)

1. **Sign in to Azure Portal**
   - Go to https://portal.azure.com
   - Sign in with your Microsoft account

2. **Create Cosmos DB Account**
   - Click "Create a resource" (+ icon in top left)
   - Search for "Azure Cosmos DB"
   - Click "Create"

3. **Configure Cosmos DB Account**

   **Basics Tab:**
   - **Subscription**: Select your subscription
   - **Resource Group**: Create new → `register-app-rg`
   - **Account Name**: `register-db-[yourname]` (must be globally unique)
   - **Location**: Choose closest region (e.g., `East US`, `West Europe`)
   - **Capacity mode**: Serverless (for development/low cost)
   - **API**: Core (SQL) ✓ (default)

   **Global Distribution Tab:**
   - **Geo-Redundancy**: Disable (saves cost for development)
   - **Multi-region Writes**: Disable

   **Networking Tab:**
   - **Connectivity method**: All networks (easier for development)
   - Note: For production, select "Selected networks" and add your IPs

   **Backup Policy Tab:**
   - Keep defaults (Periodic backup)

   **Encryption Tab:**
   - Keep defaults (Service-managed key)

4. **Review + Create**
   - Review settings
   - Click "Create"
   - Wait 5-10 minutes for deployment

#### Option B: Using Azure CLI

```bash
# Login to Azure
az login

# Create resource group
az group create \
  --name register-app-rg \
  --location eastus

# Create Cosmos DB account (NoSQL/SQL API)
az cosmosdb create \
  --name register-db-yourname \
  --resource-group register-app-rg \
  --locations regionName=eastus \
  --enable-free-tier false \
  --capabilities EnableServerless
```

### 2. Get Connection Credentials

1. **Navigate to your Cosmos DB account**
   - Azure Portal → Search "Cosmos DB" → Click your account

2. **Get Endpoint URL**
   - Left menu → Settings → "Keys"
   - Copy the **URI** (looks like: `https://register-db-yourname.documents.azure.com:443/`)

3. **Get Primary Key**
   - Same page, copy **PRIMARY KEY**
   - ⚠️ Keep this secret! Never commit to git

### 3. Configure Backend Environment

1. **Edit `.env` file** (in `register-backend/`)

   ```bash
   cd /Users/avivkatz/Desktop/fun_projects/register/register-backend
   cp .env.example .env
   nano .env  # or use your preferred editor
   ```

2. **Fill in the credentials**:

   ```env
   COSMOS_DB_ENDPOINT=https://register-db-yourname.documents.azure.com:443/
   COSMOS_DB_KEY=your-primary-key-here-very-long-string
   COSMOS_DB_DATABASE=register-db

   JWT_SECRET=generate-a-random-32-char-string
   JWT_EXPIRES_IN=24h

   PORT=3001
   NODE_ENV=development

   ALLOWED_ORIGINS=http://localhost:3000
   ```

3. **Generate JWT Secret**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy the output and paste it as JWT_SECRET

### 4. Start Backend Server

```bash
cd register-backend
npm install
npm run dev
```

The server will automatically create the database and containers on first run!

### 5. Verify Setup

1. **Check server logs** - should see:
   ```
   Database 'register-db' ready
   Container 'users' ready
   Container 'transactions' ready
   Container 'dailyTotals' ready
   Container 'helpRequests' ready
   Server running on port 3001
   ```

2. **Test health endpoint**:
   ```bash
   curl http://localhost:3001/health
   ```

   Expected: `{"status":"ok","timestamp":"..."}`

3. **Check Azure Portal**:
   - Cosmos DB → Data Explorer
   - Should see database `register-db` with 4 containers

### 6. Create First Admin User

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@school.edu",
    "password": "YourSecurePassword123!",
    "displayName": "Administrator",
    "role": "admin"
  }'
```

Save the returned `token` - you'll need it!

## Cost Optimization

### Free Tier
Azure offers 1000 RU/s and 25 GB storage free forever. This is enough for:
- Development and testing
- Small classroom deployments (< 50 students)

### Serverless Mode
- Pay only for operations you use
- No minimum charge
- Best for development and variable workloads
- Typical cost: $1-5/month for light development use

### Provisioned Throughput (Production)
- Set minimum RU/s (Request Units per second)
- Predictable costs
- Better for production with consistent load
- Starts at ~$24/month for 400 RU/s

## Security Best Practices

### Development
- ✅ Use all networks for easy testing
- ✅ Keep .env file in .gitignore
- ✅ Use different keys for dev/staging/prod

### Production
1. **Enable Firewall**:
   - Cosmos DB → Networking
   - Select "Selected networks"
   - Add your Azure App Service IP
   - Add your development IP

2. **Use Managed Identity** (Advanced):
   - App Service can authenticate without keys
   - More secure than storing keys

3. **Enable Backup**:
   - Configure continuous backup
   - Set retention policy

## Troubleshooting

### "Request rate is large" Error
- You've exceeded free tier RU/s
- Wait a moment and retry
- Consider upgrading to provisioned throughput

### "Forbidden" / 403 Errors
- Check firewall settings
- Verify primary key is correct
- Ensure key hasn't been regenerated

### Connection Timeouts
- Check endpoint URL is correct
- Verify account is in same region as your location
- Check internet connection

### Containers Not Created
- Check backend logs for errors
- Verify credentials in .env
- Manually create database in portal if needed

## Data Explorer

Access in Azure Portal → Cosmos DB → Data Explorer:

- **Query data**: SQL-like queries
- **View documents**: Browse containers
- **Scale**: Adjust throughput
- **Metrics**: Monitor performance

## Monitoring

### Key Metrics (Portal → Metrics)
- **Total Requests**: API calls
- **Total Request Units**: RU consumption
- **Data Usage**: Storage used
- **Server Side Latency**: Query performance

### Set Up Alerts
1. Portal → Cosmos DB → Alerts
2. Create alert rule
3. Condition: "Request Units > 800" (80% of free tier)
4. Action: Email notification

## Next Steps

1. ✅ Cosmos DB created and running
2. ✅ Backend connected and tested
3. Configure frontend `.env.local`:
   ```
   REACT_APP_API_URL=http://localhost:3001
   ```
4. Start frontend: `npm start`
5. Test full flow: login → transaction → view in admin dashboard
6. Deploy to production (see DEPLOYMENT_CHECKLIST.md)

## Useful Links

- [Azure Portal](https://portal.azure.com)
- [Cosmos DB Documentation](https://learn.microsoft.com/en-us/azure/cosmos-db/)
- [Pricing Calculator](https://azure.microsoft.com/en-us/pricing/calculator/)
- [Free Tier Details](https://learn.microsoft.com/en-us/azure/cosmos-db/free-tier)

## Support

- Azure Support: Portal → "?" icon → "Help + support"
- Community: Stack Overflow tag `azure-cosmosdb`
- Backend Issues: GitHub Issues in register-backend repo
