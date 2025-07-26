require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const socketHandler = require('./socket/index.js');

const mongoose = require('mongoose');
const app = express();
const server = http.createServer(app);

// Get client URL from environment
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const CORS_ORIGINS = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [CLIENT_URL];

console.log('CORS Origins:', CORS_ORIGINS);
console.log('Client URL:', CLIENT_URL);

app.use(cors({ 
  origin: CORS_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Add additional middleware for Vercel compatibility
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', CLIENT_URL);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Add these for better Vercel compatibility
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  upgradeTimeout: 10000,
  pingTimeout: 5000,
  pingInterval: 10000
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Voice Chat Server is running!', 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to check environment variables
app.get('/debug', (req, res) => {
  res.json({ 
    environment: process.env.NODE_ENV,
    clientUrl: CLIENT_URL,
    corsOrigins: CORS_ORIGINS,
    mongoConnected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/voicechat';

console.log('Connecting to MongoDB...');
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully');
    socketHandler(io); // mount socket logic
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Client URL: ${CLIENT_URL}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
