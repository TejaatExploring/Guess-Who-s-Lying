import { io } from 'socket.io-client';

// Get server URL from environment variable
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';

const socket = io(SERVER_URL);

export default socket;
