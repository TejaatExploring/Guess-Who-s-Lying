# 🎮 Voice Chat App

A real-time voice chat application built with React, Node.js, Socket.IO, and WebRTC. Perfect for gaming groups, online meetings, or casual conversations.

## ✨ Features

- **Real-time Voice Chat**: High-quality voice communication using WebRTC
- **Room-based System**: Create or join rooms with unique 6-digit codes
- **Game Integration**: Sentence-sharing mini-game with voice chat
- **Real-time Updates**: Live user list and game state synchronization
- **Responsive Design**: Works on desktop and mobile devices
- **MongoDB Persistence**: Game states saved to database
- **Maximum 6 Players**: Optimal group size for voice chat

## 🚀 Live Demo

- **Frontend**: [Your Frontend URL]
- **Backend**: [Your Backend URL]

## 🛠 Tech Stack

### Frontend
- React 19.1.0
- React Router DOM
- Socket.IO Client
- Vite (Build tool)

### Backend
- Node.js
- Express.js
- Socket.IO
- MongoDB with Mongoose
- WebRTC for peer-to-peer communication

## 📦 Installation

### Prerequisites
- Node.js (>= 18.0.0)
- MongoDB (local installation OR MongoDB Atlas account)
- npm or yarn

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/voice-chat-app.git
   cd voice-chat-app
   ```

2. **Setup MongoDB**
   
   **Option A: Local MongoDB (Recommended for development)**
   - Install MongoDB locally (see [MONGODB_SETUP.md](./MONGODB_SETUP.md))
   - No additional configuration needed
   
   **Option B: MongoDB Atlas (Cloud)**
   - Create free cluster at https://cloud.mongodb.com
   - Get connection string (see [MONGODB_SETUP.md](./MONGODB_SETUP.md))

3. **Install dependencies**
   ```bash
   npm run install:all
   # or manually:
   # cd server && npm install && cd ../client && npm install
   ```

3. **Environment Setup**
   
   **Server (.env)**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your settings
   ```
   
   **Client (.env)**
   ```bash
   cd client
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start Development Servers**
   ```bash
   # From project root
   npm run dev
   
   # Or separately:
   npm run dev:server  # Starts backend on port 5000
   npm run dev:client  # Starts frontend on port 5173
   ```

## 🌐 Deployment

This application is optimized for deployment on **Vercel**.

### Quick Deployment

1. **Prepare for deployment**
   ```bash
   npm run install:all
   ```

2. **Deploy Backend**
   ```bash
   cd server
   vercel --prod
   ```

3. **Deploy Frontend**
   ```bash
   cd client
   vercel --prod
   ```

### Detailed Deployment Guide

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment instructions.

## 🎯 Usage

### Creating a Room
1. Enter your name
2. Click "Create New Room"
3. Share the 6-digit room code with friends

### Joining a Room
1. Enter your name
2. Enter the 6-digit room code
3. Click "Join Room"

### Voice Chat
1. Click "Start Call" to begin voice chat
2. Use the microphone toggle to mute/unmute
3. Other players will automatically connect

### Game Features
- Room creator can start sentence games
- Real-time sentence sharing
- Voice chat during gameplay

## 📁 Project Structure

```
voice-chat-app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── socket.js      # Socket.IO client setup
│   │   └── main.jsx       # App entry point
│   ├── .env               # Environment variables
│   ├── vercel.json        # Vercel config
│   └── package.json
├── server/                # Node.js backend
│   ├── models/           # MongoDB schemas
│   ├── socket/           # Socket.IO handlers
│   ├── .env              # Environment variables
│   ├── vercel.json       # Vercel config
│   ├── server.js         # Express server
│   └── package.json
├── DEPLOYMENT.md         # Deployment guide
├── deploy.sh/.bat        # Deployment scripts
└── package.json          # Root package.json
```

## 🔧 Environment Variables

### Server
```env
MONGO_URI=mongodb+srv://...
CLIENT_URL=https://your-frontend.vercel.app
PORT=5000
NODE_ENV=production
```

### Client
```env
VITE_SERVER_URL=https://your-backend.vercel.app
VITE_NODE_ENV=production
```

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure `CLIENT_URL` matches your frontend URL exactly
   - Check environment variables in Vercel dashboard

2. **Database Connection**
   - Verify MongoDB Atlas connection string
   - Check network access settings (whitelist IPs)

3. **Voice Chat Not Working**
   - Ensure HTTPS is enabled (required for WebRTC)
   - Check browser permissions for microphone access

4. **Socket Connection Issues**
   - Verify `VITE_SERVER_URL` is correct
   - Check server logs for connection errors

### Debug Mode

Enable debug logs by setting:
```env
DEBUG=socket.io*
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👏 Acknowledgments

- Socket.IO for real-time communication
- WebRTC for peer-to-peer voice chat
- Vercel for seamless deployment
- MongoDB Atlas for cloud database

## 📞 Support

If you encounter any issues:

1. Check the [troubleshooting section](#-troubleshooting)
2. Review [DEPLOYMENT.md](./DEPLOYMENT.md)
3. Open an issue on GitHub
4. Check Vercel deployment logs

---

**Happy chatting!** 🎉
