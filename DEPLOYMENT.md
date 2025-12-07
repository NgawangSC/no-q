# Railway Deployment Guide for No-Q

This guide will walk you through deploying the No-Q application to Railway.

## Prerequisites

1. A Railway account (sign up at https://railway.app)
2. A MongoDB database (MongoDB Atlas recommended)
3. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Prepare Your Repository

Make sure your code is committed and pushed to a Git repository (GitHub, GitLab, or Bitbucket).

## Step 2: Create a New Railway Project

1. Go to https://railway.app and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo" (or your Git provider)
4. Choose your repository
5. Railway will automatically detect it's a Node.js project

## Step 3: Add MongoDB Database

1. In your Railway project, click "+ New"
2. Select "Database"
3. Choose "MongoDB"
4. Railway will provision a MongoDB instance
5. Once created, click on the MongoDB service
6. Go to the "Variables" tab
7. Look for `MONGO_URL` or `MONGODB_URI` connection string
8. **IMPORTANT**: The connection string should include:
   - Username and password
   - Host (external address, not `.internal`)
   - Port (usually 27017)
   - Database name (add `/your_database_name` if not present)
   - Connection options

**Example format:**
```
mongodb://username:password@host:27017/database_name?retryWrites=true&w=majority
```

**Note**: If Railway provides an internal address (`mongodb.railway.internal`), you may need to:
- Use the external connection string from the "Connect" tab
- Or add the database name: `mongodb://mongo:password@mongodb.railway.internal:27017/your_database_name`

## Step 4: Configure Environment Variables

**⚠️ IMPORTANT: These environment variables MUST be set before deployment, or you'll get 500 errors!**

In your Railway project, go to your service → "Variables" tab and add:

### Required Environment Variables

```
MONGODB_URI=<your_mongodb_connection_string_from_railway>
JWT_SECRET=<generate_a_random_secret_key_here>
PORT=3000
NODE_ENV=production
CLIENT_ORIGIN=https://your-app-name.up.railway.app
```

**Critical:** 
- `JWT_SECRET` is **REQUIRED** - login will fail with 500 error if not set
- `MONGODB_URI` is **REQUIRED** - database operations will fail if not set
- `CLIENT_ORIGIN` should match your Railway app URL exactly

### How to Generate JWT_SECRET

You can generate a secure JWT secret using:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Or use an online generator: https://www.uuidgenerator.net/

### Important Notes:

- **MONGODB_URI**: Use the connection string from Railway's MongoDB service
- **CLIENT_ORIGIN**: Replace `your-app-name` with your actual Railway app domain (you'll get this after deployment)
- **JWT_SECRET**: Use a long, random string (at least 32 characters)

## Step 5: Configure Build Settings

Railway should automatically detect Node.js. Verify these settings:

1. Go to your service → "Settings"
2. **Build Command**: (leave empty - Railway auto-detects)
3. **Start Command**: `npm start`
4. **Root Directory**: `/` (root of your repository)

## Step 6: Deploy

1. Railway will automatically start deploying when you push to your repository
2. Or click "Deploy" in the Railway dashboard
3. Wait for the deployment to complete
4. Check the "Deployments" tab for logs

## Step 7: Get Your App URL

1. After deployment, go to your service → "Settings"
2. Click "Generate Domain" to get a public URL
3. Copy this URL
4. Update the `CLIENT_ORIGIN` environment variable with this URL
5. Redeploy if needed (Railway may auto-redeploy when env vars change)

## Step 8: Verify Deployment

1. Visit your Railway app URL
2. Test the application:
   - Login as admin
   - Create staff members
   - Register patients
   - Test the queue system

## Step 9: Update CORS (if needed)

If you need to allow your custom domain:

1. Go to Environment Variables
2. Update `CLIENT_ORIGIN` to include your domain:
   ```
   CLIENT_ORIGIN=https://your-app-name.up.railway.app,https://your-custom-domain.com
   ```

## Troubleshooting

### Application won't start
- Check the deployment logs in Railway
- Verify all environment variables are set
- Ensure `MONGODB_URI` is correct

### Database connection errors
- Verify `MONGODB_URI` is set correctly
- **CRITICAL: Check if database name is included** - add `/database_name` if missing
  - Your current URI: `mongodb://mongo:password@mongodb.railway.internal:27017`
  - Should be: `mongodb://mongo:password@mongodb.railway.internal:27017/noq` (add `/noq` or your preferred database name)
- If using internal Railway MongoDB, ensure the database name is in the URI
- Check MongoDB service is running in Railway
- Ensure the connection string includes authentication
- Try using the external connection string from MongoDB service "Connect" tab instead of internal

### 404 errors
- Verify the app is running (check logs)
- Ensure all routes are properly configured
- Check if the PORT environment variable is set

### CORS errors
- Update `CLIENT_ORIGIN` environment variable
- Include the exact Railway domain URL

## Environment Variables Summary

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority

# Security
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters

# Server
PORT=3000
NODE_ENV=production

# CORS
CLIENT_ORIGIN=https://your-app-name.up.railway.app
```

## Additional Tips

1. **MongoDB Atlas Alternative**: If you prefer using MongoDB Atlas instead of Railway's MongoDB:
   - Create a free cluster at https://www.mongodb.com/cloud/atlas
   - Get the connection string
   - Use it as `MONGODB_URI`

2. **Custom Domain**: Railway supports custom domains in paid plans

3. **Monitoring**: Railway provides built-in monitoring and logs for your application

4. **Automatic Deployments**: Railway automatically deploys on every push to your main branch (configurable)

5. **Rollbacks**: You can rollback to previous deployments in the "Deployments" tab

## Support

For Railway-specific issues, check:
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway

