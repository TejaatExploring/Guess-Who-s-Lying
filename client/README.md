# Voice Chat App - Client

Frontend for the Voice Chat Game application built with React and Vite.

## Features
- Real-time multiplayer game interface
- Voice chat integration
- Room creation and joining
- Responsive design
- Socket.io client for real-time updates

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `VITE_SERVER_URL`: Backend server URL

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

4. Build for production:
```bash
npm run build
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
   - `VITE_SERVER_URL`: Your deployed backend URL

## Tech Stack

- React 19
- Vite 7
- React Router DOM
- Socket.io Client
- WebRTC for voice chat

## Project Structure

```
src/
├── components/
│   ├── JoinRoom.jsx    # Landing page for joining/creating games
│   └── Room.jsx        # Main game room interface
├── socket.js           # Socket.io client configuration
├── App.jsx            # Main app component with routing
└── main.jsx           # Entry point
```

## Game Rules

- Maximum 6 players per game
- Creator starts the sentences
- Voice chat available during game
- Real-time chat messaging
