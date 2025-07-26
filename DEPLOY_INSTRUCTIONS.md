# 🚀 MERN App Deployment on Vercel - Step by Step

## ⚠️ IMPORTANT: Deploy Backend First, Then Frontend

### 🏗️ Backend Deployment (Deploy First)

1. **Open Terminal and Navigate to Server Directory:**
   ```bash
   cd server
   ```

2. **Install Vercel CLI (if not installed):**
   ```bash
   npm install -g vercel
   ```

3. **Deploy Server:**
   ```bash
   vercel --prod
   ```

4. **Set Environment Variables in Vercel Dashboard:**
   - Go to: https://vercel.com/dashboard
   - Select your server project
   - Go to Settings > Environment Variables
   - Add these variables:
     - `MONGO_URI`: `mongodb+srv://bhanuteja2794:bM6yfJX6bJQRgs@cluster0.ztuelje.mongodb.net/voicechat?retryWrites=true&w=majority`
     - `NODE_ENV`: `production`
     - `CLIENT_URL`: `https://YOUR-FRONTEND-URL.vercel.app` (you'll update this after frontend deployment)

5. **Note Your Backend URL** (something like `https://guess-whos-lying-server-xyz123.vercel.app`)

### 🎨 Frontend Deployment (Deploy Second)

1. **Update Client Environment Variables:**
   - Update the `.env` file in the client folder
   - Set `VITE_SERVER_URL` to your deployed backend URL from step 5 above

2. **Navigate to Client Directory:**
   ```bash
   cd ../client
   ```

3. **Deploy Client:**
   ```bash
   vercel --prod
   ```

4. **Set Environment Variables in Vercel Dashboard:**
   - Go to your client project in Vercel dashboard
   - Go to Settings > Environment Variables
   - Add these variables:
     - `VITE_SERVER_URL`: Your backend URL from backend deployment
     - `VITE_NODE_ENV`: `production`

5. **Note Your Frontend URL** (something like `https://guess-whos-lying-client-abc456.vercel.app`)

### 🔄 Final Configuration Update

1. **Update Backend CORS Settings:**
   - Go back to your server project in Vercel dashboard
   - Update the `CLIENT_URL` environment variable with your actual frontend URL
   - Redeploy the backend: `cd server && vercel --prod`

### ✅ Testing

1. Visit your frontend URL
2. Test creating a room
3. Test joining a room with another browser/device
4. Test voice chat functionality

## 🐛 Common Issues & Solutions

### Issue: "Can't parse json file"
- **Cause:** JSON syntax error in package.json
- **Solution:** Validate your package.json files using a JSON validator

### Issue: CORS Errors
- **Cause:** CLIENT_URL doesn't match frontend URL exactly
- **Solution:** Ensure no trailing slashes and exact URL match

### Issue: Socket.IO Connection Failed
- **Cause:** Wrong VITE_SERVER_URL or server not deployed
- **Solution:** Double-check backend URL and environment variables

### Issue: Database Connection Failed
- **Cause:** MongoDB Atlas network access or wrong connection string
- **Solution:** Check MongoDB Atlas dashboard, ensure IP whitelist includes 0.0.0.0/0

## 📝 Deployment Checklist

**Backend:**
- [ ] MongoDB Atlas cluster created and configured
- [ ] Server deployed to Vercel
- [ ] Environment variables set in Vercel dashboard
- [ ] Backend URL noted

**Frontend:**
- [ ] Client .env updated with backend URL
- [ ] Client deployed to Vercel
- [ ] Environment variables set in Vercel dashboard
- [ ] Frontend URL noted

**Final:**
- [ ] Backend CLIENT_URL updated with frontend URL
- [ ] Backend redeployed
- [ ] Application tested end-to-end

## 🔗 Important URLs

- **Vercel Dashboard:** https://vercel.com/dashboard
- **MongoDB Atlas:** https://cloud.mongodb.com
- **Your Backend URL:** ________________________________
- **Your Frontend URL:** _______________________________

## 🆘 If Still Having Issues

1. Check Vercel deployment logs in dashboard
2. Use browser developer tools to check console errors
3. Verify all environment variables are set correctly
4. Ensure MongoDB Atlas allows connections from all IPs (0.0.0.0/0)

Good luck with your deployment! 🎉
