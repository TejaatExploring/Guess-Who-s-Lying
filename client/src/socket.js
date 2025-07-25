import { io } from 'socket.io-client';

// Get server URL from environment variable
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const socket = io(SERVER_URL, {
  // Enable automatic reconnection
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 10,
  timeout: 20000,
  forceNew: false
});

export default socket;
