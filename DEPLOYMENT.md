# Voice Chat App - Vercel Deployment Guide

This MERN stack application is configured for deployment on Vercel for both frontend and backend.

## 🚀 Deployment Steps

### Prerequisites
1. MongoDB Atlas account and cluster set up
2. Vercel account
3. Git repository pushed to GitHub/GitLab/Bitbucket

### Backend Deployment (Server)

1. **Deploy to Vercel:**
   ```bash
   cd server
   vercel --prod
   ```

2. **Set Environment Variables in Vercel Dashboard:**
   - `MONGO_URI`: Your MongoDB Atlas connection string
   - `CLIENT_URL`: Your frontend Vercel URL (e.g., https://your-app.vercel.app)
   - `NODE_ENV`: production

3. **MongoDB Atlas Setup:**
   - Create a cluster on MongoDB Atlas
   - Add your IP address to the whitelist (or use 0.0.0.0/0 for all IPs)
   - Create a database user with read/write permissions
   - Get your connection string and replace in `MONGO_URI`

### Frontend Deployment (Client)

1. **Update Environment Variables:**
   - Update `VITE_SERVER_URL` in `.env` with your deployed backend URL

2. **Deploy to Vercel:**
   ```bash
   cd client
   vercel --prod
   ```

3. **Set Environment Variables in Vercel Dashboard:**
   - `VITE_SERVER_URL`: Your backend Vercel URL (e.g., https://your-backend.vercel.app)
   - `VITE_NODE_ENV`: production

### Final Steps

1. **Update CORS Settings:**
   - Update `CLIENT_URL` environment variable in your backend deployment
   - Set it to your deployed frontend URL

2. **Test the Application:**
   - Visit your deployed frontend URL
   - Test creating and joining rooms
   - Verify voice chat functionality

## 🛠 Local Development

### Server Setup
```bash
cd server
npm install
cp .env.example .env
# Edit .env with your local settings
npm run dev
```

### Client Setup
```bash
cd client
npm install
cp .env.example .env
# Edit .env with your local settings
npm run dev
```

## 📁 Project Structure

```
voice-chat-app/
├── client/                 # React frontend
│   ├── src/
│   ├── .env               # Client environment variables
│   ├── .env.example       # Client environment template
│   ├── vercel.json        # Vercel config for frontend
│   └── package.json
├── server/                # Node.js backend
│   ├── models/
│   ├── socket/
│   ├── .env              # Server environment variables
│   ├── .env.example      # Server environment template
│   ├── vercel.json       # Vercel config for backend
│   └── package.json
└── README.md
```

## 🔧 Environment Variables

### Server (.env)
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/voicechat
CLIENT_URL=https://your-frontend.vercel.app
PORT=5000
NODE_ENV=production
```

### Client (.env)
```
VITE_SERVER_URL=https://your-backend.vercel.app
VITE_NODE_ENV=production
```

## 🐛 Troubleshooting

### Common Issues:

1. **CORS Errors:** Ensure `CLIENT_URL` in server matches your frontend URL exactly
2. **Database Connection:** Verify MongoDB Atlas connection string and network access
3. **Socket.IO Issues:** Make sure both URLs in environment variables are correct
4. **Build Failures:** Check that all dependencies are listed in package.json

### Logs:
- Check Vercel deployment logs in the dashboard
- Use `vercel logs` command for runtime logs

## 📚 Features

- Real-time voice chat using WebRTC
- Socket.IO for real-time communication
- MongoDB for game state persistence
- Room-based gameplay (max 6 players)
- Responsive design

## 🔒 Security Notes

- Never commit `.env` files to version control
- Use strong passwords for MongoDB Atlas
- Regularly rotate database credentials
- Keep dependencies updated

## 📞 Support

If you encounter issues during deployment, check:
1. Vercel deployment logs
2. MongoDB Atlas network access settings
3. Environment variable configuration
4. CORS configuration

Happy deploying! 🎉
