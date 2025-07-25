# Voice Chat App - Server

Backend server for the Voice Chat Game application.

## Features
- Real-time multiplayer game rooms
- Socket.io for WebSocket connections
- MongoDB for data persistence
- Voice chat with WebRTC
- Room management with game states

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `PORT`: Server port (default: 5000)
- `MONGO_URI`: MongoDB connection string
- `CLIENT_URL`: Frontend URL for CORS
- `NODE_ENV`: Environment (development/production)

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables in `.env`

3. Start development server:
```bash
npm run dev
```

## Deployment to Vercel

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard:
   - `MONGO_URI`: Your MongoDB Atlas connection string
   - `CLIENT_URL`: Your deployed frontend URL
   - `NODE_ENV`: production

## MongoDB Setup

For production, use MongoDB Atlas:
1. Create a cluster at https://cloud.mongodb.com
2. Get connection string
3. Add to `MONGO_URI` environment variable

## API Endpoints

- Socket.io endpoints for real-time communication
- Game room management
- Player connection handling
