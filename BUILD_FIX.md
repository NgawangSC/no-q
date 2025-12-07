# Fix for "secret env not found" Build Error

## The Problem

Railway's build system is trying to access environment variables during the build phase, which causes the "secret env not found" error.

## Solution Applied

1. **Made dotenv conditional** - Only loads in development, not production
2. **Made MongoDB URI lazy** - Only accessed at runtime
3. **Added build-time safety checks** - Prevents env var access during build

## Important: Railway Configuration

### Option 1: Set Variables as Plain Variables (Recommended)

In Railway, make sure your environment variables are set as **plain variables**, not secrets:

1. Go to Railway → Your Service → "Variables"
2. For each variable, make sure it's set as a **Variable**, not a **Secret**
3. If you see a "Secret" badge, you can convert it to a variable

### Option 2: Use Railway's Variable Reference

For `MONGODB_URI`, use Railway's built-in reference:

1. Go to Variables → "Reference Variable"
2. Select your MongoDB service
3. Select `MONGO_URL` or `MONGODB_URI`
4. This creates a reference that Railway manages automatically

### Option 3: Remove railway.json (Let Railway Auto-Detect)

Try removing `railway.json` and let Railway auto-detect everything:

```bash
git rm railway.json
git commit -m "Remove railway.json for auto-detection"
git push
```

Railway will auto-detect Node.js and use default settings.

## After Making Changes

1. **Commit and push:**
   ```bash
   git add .
   git commit -m "Fix build error - conditional dotenv loading"
   git push
   ```

2. **Verify in Railway:**
   - Check that all variables are set
   - Make sure they're plain variables, not secrets
   - Trigger a new deployment

3. **Check build logs:**
   - Should see successful build
   - No "secret env not found" error
   - Should see "npm ci" completing successfully

## If Still Failing

If the build still fails:

1. **Check Railway Service Settings:**
   - Go to Settings
   - Make sure "Build Command" is empty (Railway auto-detects)
   - Make sure "Start Command" is `npm start`

2. **Try Manual Build:**
   - In Railway, go to Deployments
   - Click "Redeploy"
   - Watch the build logs carefully

3. **Contact Railway Support:**
   - The error might be a Railway platform issue
   - Check Railway status page
   - Contact Railway support with build logs

