# Vercel Deployment Checklist

## Pre-Deployment Setup

### 1. MongoDB Atlas Setup
- [ ] Create MongoDB Atlas account
- [ ] Create a cluster
- [ ] Create database user with read/write permissions
- [ ] Whitelist IP addresses (0.0.0.0/0 for all or specific IPs)
- [ ] Get connection string

### 2. Prepare Environment Variables
- [ ] Note your MongoDB connection string
- [ ] Prepare to set frontend and backend URLs

## Backend Deployment (Deploy First)

### 1. Deploy Server to Vercel
```bash
cd server
vercel --prod
```

### 2. Set Environment Variables in Vercel Dashboard
Go to: Vercel Dashboard > Your Project > Settings > Environment Variables

**Required Variables:**
- `MONGO_URI`: `mongodb+srv://username:password@cluster.mongodb.net/voicechat?retryWrites=true&w=majority`
- `CLIENT_URL`: `https://your-frontend-url.vercel.app` (you'll get this after frontend deployment)
- `NODE_ENV`: `production`

**Note:** You'll need to update `CLIENT_URL` after frontend deployment.

## Frontend Deployment (Deploy Second)

### 1. Update Client Environment
- [ ] Update `VITE_SERVER_URL` in `.env` with your deployed backend URL

### 2. Deploy Client to Vercel
```bash
cd client
vercel --prod
```

### 3. Set Environment Variables in Vercel Dashboard
**Required Variables:**
- `VITE_SERVER_URL`: `https://your-backend-url.vercel.app`
- `VITE_NODE_ENV`: `production`

## Final Configuration

### 1. Update Backend CORS
- [ ] Go back to backend Vercel project settings
- [ ] Update `CLIENT_URL` environment variable with your actual frontend URL
- [ ] Trigger a new deployment or wait for automatic redeployment

### 2. Test Deployment
- [ ] Visit your frontend URL
- [ ] Test creating a room
- [ ] Test joining a room
- [ ] Test voice chat functionality
- [ ] Check browser console for errors
- [ ] Check Vercel function logs for backend errors

## Common Issues & Solutions

### CORS Errors
- Ensure `CLIENT_URL` in backend exactly matches frontend URL
- Check for trailing slashes or protocol mismatches

### Database Connection Errors
- Verify MongoDB Atlas connection string
- Check network access settings in MongoDB Atlas
- Ensure database user has correct permissions

### Build Failures
- Check Vercel build logs
- Ensure all dependencies are in package.json
- Verify Node.js version compatibility

### Socket.IO Connection Issues
- Verify `VITE_SERVER_URL` is correct
- Check if HTTPS is enabled (required for production)
- Test with browser dev tools network tab

## Useful Commands

```bash
# Check Vercel logs
vercel logs

# Redeploy
vercel --prod

# List environment variables
vercel env ls

# Add environment variable
vercel env add VARIABLE_NAME
```

## URLs to Save
- Backend URL: ________________________________
- Frontend URL: _______________________________
- MongoDB Atlas Dashboard: https://cloud.mongodb.com
- Vercel Dashboard: https://vercel.com/dashboard
