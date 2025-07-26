# 🚀 Fixed Deployment Guide

## Issues Fixed:

1. **CORS Configuration**: Removed trailing slash from CLIENT_URL
2. **Socket.io Configuration**: Added better transports and debugging
3. **Environment Variables**: Added debug endpoint to check configuration
4. **Header Configuration**: Added explicit CORS headers for Vercel

## Deployment Steps:

### 1. Deploy Backend First:
```bash
cd server
vercel --prod
```

### 2. Update Environment Variables in Vercel Dashboard:
- Go to your server project in Vercel dashboard
- Set these environment variables:
  - `MONGO_URI`: `mongodb+srv://bhanuteja2794:bM6yfJX6bJQRgs@cluster0.ztuelje.mongodb.net/voicechat?retryWrites=true&w=majority`
  - `CLIENT_URL`: `https://guess-who-s-lying-client.vercel.app` (no trailing slash!)
  - `NODE_ENV`: `production`

### 3. Get Your Backend URL:
- Note the deployed backend URL (e.g., `https://guess-whos-lying-server-abc123.vercel.app`)

### 4. Update Client Environment:
- Update `.env` file in client folder with your actual backend URL:
  ```
  VITE_SERVER_URL=https://your-actual-backend-url.vercel.app
  ```

### 5. Deploy Frontend:
```bash
cd client
vercel --prod
```

### 6. Update Backend CORS:
- Go back to server project in Vercel dashboard
- Update `CLIENT_URL` with your actual frontend URL (no trailing slash)
- Redeploy backend

## Testing:

1. Visit `https://your-backend-url.vercel.app/debug` to verify configuration
2. Check browser console for connection messages
3. Test room creation and joining

## Common URLs:
- Debug endpoint: `https://guess-whos-lying-server.vercel.app/debug`
- Health check: `https://guess-whos-lying-server.vercel.app/health`
