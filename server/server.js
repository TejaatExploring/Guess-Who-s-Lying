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

app.use(cors({ 
  origin: CORS_ORIGINS,
  credentials: true 
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Voice Chat Server is running!', 
    status: 'healthy',
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
