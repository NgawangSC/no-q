# Troubleshooting Railway Deployment

## Build Error: "secret env not found"

### Issue: Railway Build Failing

**Error Message:**
```
Build Failed: build daemon returned an error < failed to solve: secret env not found >
```

### Solutions:

#### Solution 1: Set Environment Variables Before Build

1. Go to Railway dashboard
2. Click your service
3. Go to "Variables" tab
4. **Make sure ALL environment variables are set BEFORE deploying:**
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `NODE_ENV`
   - `PORT`
   - `CLIENT_ORIGIN`

5. After setting variables, trigger a new deployment

#### Solution 2: Check Railway Service Configuration

1. Go to your service → "Settings"
2. Check "Build Command" - should be empty (Railway auto-detects)
3. Check "Start Command" - should be `npm start`
4. Make sure no build scripts are trying to access secrets

#### Solution 3: Use Railway's MongoDB Service Reference

Instead of manually setting `MONGODB_URI`, you can reference Railway's MongoDB service:

1. In your service → "Variables" tab
2. Click "Reference Variable"
3. Select your MongoDB service
4. Select `MONGO_URL` or `MONGODB_URI`
5. This creates a reference that Railway manages automatically

#### Solution 4: Check for Build Scripts

Make sure your `package.json` doesn't have build scripts that access environment variables:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

**Don't add scripts like:**
```json
{
  "scripts": {
    "build": "node -e 'process.env.SECRET'",  // ❌ This will fail
    "prebuild": "check-env"  // ❌ This might fail
  }
}
```

### After Fixing:

1. Commit and push your changes
2. Railway will automatically redeploy
3. Check the build logs to verify it succeeds
4. Check runtime logs to verify the app starts

## 500 Error on Login

### Issue: Missing Database Name in MONGODB_URI

**Your current MONGODB_URI:**
```
mongodb://mongo:FNQZUHtyUiXzJPvaHRqOuZpfrejlCgjb@mongodb.railway.internal:27017
```

**Problem:** Missing database name at the end.

**Fix:** Add a database name to your connection string:

```
mongodb://mongo:FNQZUHtyUiXzJPvaHRqOuZpfrejlCgjb@mongodb.railway.internal:27017/noq
```

Or use any database name you prefer:
```
mongodb://mongo:FNQZUHtyUiXzJPvaHRqOuZpfrejlCgjb@mongodb.railway.internal:27017/railway
```

### How to Fix in Railway

1. Go to your Railway project
2. Click on your service (not the MongoDB service)
3. Go to "Variables" tab
4. Find `MONGODB_URI`
5. Edit it to add the database name at the end:
   - Change from: `mongodb://mongo:...@mongodb.railway.internal:27017`
   - Change to: `mongodb://mongo:...@mongodb.railway.internal:27017/noq`
6. Save the variable
7. Railway will automatically redeploy

### Alternative: Use External Connection String

If the internal connection doesn't work:

1. Go to your MongoDB service in Railway
2. Click on "Connect" tab
3. Copy the external connection string (usually starts with `mongodb+srv://`)
4. Use that as your `MONGODB_URI`
5. Make sure it includes the database name

### Verify Environment Variables

Make sure all these are set in Railway:

✅ `MONGODB_URI` - with database name included
✅ `JWT_SECRET` - your secret key
✅ `NODE_ENV=production`
✅ `PORT=3000`
✅ `CLIENT_ORIGIN` - your Railway app URL

### Check Railway Logs

1. Go to Railway dashboard
2. Click your service
3. Click "Deployments"
4. Click the latest deployment
5. Check logs for:
   - "✅ Connected to MongoDB" - means DB connection worked
   - "❌ MongoDB connection error" - means DB connection failed
   - "JWT_SECRET is not set" - means JWT_SECRET is missing

### Common Error Messages

**"MongoDB connection error"**
- Fix: Add database name to MONGODB_URI
- Format: `mongodb://user:pass@host:port/database_name`

**"JWT_SECRET environment variable is not set"**
- Fix: Add JWT_SECRET to environment variables

**"Invalid credentials" (401)**
- This is normal - means credentials are wrong, not a server error

**"Something went wrong!" (500)**
- Check Railway logs for the actual error
- Usually means missing JWT_SECRET or database connection issue

