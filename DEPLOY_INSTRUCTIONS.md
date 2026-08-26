# Deploy Backend to Heroku - Step by Step

## 1. Login to Heroku
```bash
cd /Users/avivkatz/Desktop/fun_projects/register/register-backend
heroku login
```
(This will open a browser window to login)

## 2. Create Heroku App
```bash
heroku create register-backend-app
```
(Choose a different name if this is taken)

## 3. Set Environment Variables
Copy and paste all these commands:

```bash
heroku config:set COSMOS_DB_ENDPOINT=<your-cosmos-endpoint>
heroku config:set COSMOS_DB_KEY=<your-cosmos-key>
heroku config:set COSMOS_DB_DATABASE=<your-database-name>
heroku config:set JWT_SECRET=<your-jwt-secret>
heroku config:set JWT_EXPIRES_IN=24h
heroku config:set NODE_ENV=production
heroku config:set ALLOWED_ORIGINS=http://localhost:3000,<your-frontend-url>
```

## 4. Deploy to Heroku
```bash
git push heroku main
```

## 5. Check if it's working
```bash
heroku open /health
```

## 6. Get your backend URL
```bash
heroku info -s | grep web_url | cut -d= -f2
```

Copy this URL - you'll need it for the frontend!

## 7. Update Frontend Environment
Once you have your Heroku URL (e.g., `https://register-backend-app.herokuapp.com`):

Edit `/Users/avivkatz/Desktop/fun_projects/register/register/.env.production` and add:
```
REACT_APP_API_URL=https://register-backend-app.herokuapp.com
DISABLE_ESLINT_PLUGIN=true
CI=false
```

## 8. Deploy Frontend
```bash
cd /Users/avivkatz/Desktop/fun_projects/register/register
git add .env.production
git commit -m "Update API URL to Heroku backend"
git push origin main
```

Vercel will automatically redeploy your frontend with the new backend URL!

---

**Troubleshooting:**
- If `git push heroku main` fails, make sure you're on the `main` branch
- If the app name is taken, choose a different name in step 2
- Check logs with: `heroku logs --tail`
