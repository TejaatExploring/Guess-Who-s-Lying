# Voice Chat App - Client

Frontend for the Voice Chat Game application built with React and Vite.

## Features
- Real-time multiplayer game interface
- Voice chat integration
- Room creation and joining
- Responsive design
- Socket.io client for real-time updates

## Environment Variables

### Local Development Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update the `.env` file with your local server URL:
```env
VITE_SERVER_URL=http://localhost:5000
```

### Production Deployment

For production deployment, you'll need to set the environment variable to your deployed backend URL:

```env
VITE_SERVER_URL=https://your-backend-app.vercel.app
```

**Required environment variables:**
- `VITE_SERVER_URL`: Backend server URL (local: http://localhost:5000, production: your deployed backend URL)

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

### Option 1: Using Vercel CLI

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. Set environment variables in Vercel dashboard or CLI:
```bash
vercel env add VITE_SERVER_URL
# Enter your backend URL when prompted (e.g., https://your-backend-app.vercel.app)
```

### Option 2: Using Vercel Dashboard

1. Connect your GitHub repository to Vercel
2. Import the project and set the root directory to `client`
3. Add environment variable in the Vercel project settings:
   - **Name**: `VITE_SERVER_URL`
   - **Value**: Your deployed backend URL (e.g., `https://your-backend-app.vercel.app`)

### Important Notes for Deployment

- Make sure your backend is deployed first and get its URL
- Update `VITE_SERVER_URL` with the correct backend URL
- The environment variable must start with `VITE_` to be accessible in the browser

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
