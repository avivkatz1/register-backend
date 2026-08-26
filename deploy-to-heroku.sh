#!/bin/bash

# Deployment script for register-backend to Heroku

echo "🚀 Deploying register-backend to Heroku..."
echo ""

# Step 1: Login to Heroku
echo "Step 1: Logging in to Heroku..."
heroku login -i

# Step 2: Create Heroku app (or use existing)
echo ""
echo "Step 2: Creating Heroku app..."
APP_NAME="register-backend-${USER}-$(date +%s)"
heroku create $APP_NAME

# Step 3: Set environment variables
echo ""
echo "Step 3: Setting environment variables..."
heroku config:set COSMOS_DB_ENDPOINT=<your-cosmos-endpoint>
heroku config:set COSMOS_DB_KEY=<your-cosmos-key>
heroku config:set COSMOS_DB_DATABASE=<your-database-name>
heroku config:set JWT_SECRET=<your-jwt-secret>
heroku config:set JWT_EXPIRES_IN=24h
heroku config:set NODE_ENV=production
heroku config:set ALLOWED_ORIGINS=http://localhost:3000,https://register-chi-seven.vercel.app

# Step 4: Deploy to Heroku
echo ""
echo "Step 4: Deploying to Heroku..."
git push heroku main

# Step 5: Verify deployment
echo ""
echo "Step 5: Verifying deployment..."
heroku open /health

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Your backend is now running at:"
heroku info -s | grep web_url | cut -d= -f2
echo ""
echo "Next steps:"
echo "1. Copy the URL above"
echo "2. Update your frontend .env.production with: REACT_APP_API_URL=<your-heroku-url>"
echo "3. Push your frontend to trigger Vercel deployment"
