import { io } from 'socket.io-client';

// Get server URL from environment variable
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

console.log('Connecting to server:', SERVER_URL);

const socket = io(SERVER_URL, {
  // Enable automatic reconnection
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 10,
  timeout: 20000,
  forceNew: false,
  // Add these for better production compatibility
  transports: ['websocket', 'polling'],
  upgrade: true
});

// Add connection event listeners for debugging
socket.on('connect', () => {
  console.log('✅ Connected to server:', SERVER_URL);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

export default socket;
