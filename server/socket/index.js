const Room = require('../models/Room');
const fs = require('fs');
const path = require('path');

function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join-room', async ({ roomId, userName }) => {
      socket.join(roomId);
      let room = await Room.findOne({ roomId });
      if (!room) {
        // First user is creator
        try {
          room = await Room.create({ roomId, creator: userName, users: [userName] });
        } catch (err) {
          // If duplicate key error, fetch the room again
          if (err.code === 11000) {
            room = await Room.findOne({ roomId });
          } else {
            throw err;
          }
        }
      } else {
        // Use $addToSet to ensure userName is only added once
        await Room.updateOne({ roomId }, { $addToSet: { users: userName } });
      }
      // Always fetch latest room after possible update
      room = await Room.findOne({ roomId });
      // If users array is empty (shouldn't happen), add creator
      if (!room.users.length) {
        room.users = [room.creator];
        await room.save();
      }
      io.in(roomId).emit('all-users', { users: room.users.map(u => ({ userName: u })), creator: room.creator });
      console.log(`${userName} joined room: ${roomId}`);
    });

    // Handle start-sentences event from creator
    socket.on('start-sentences', async ({ roomId }) => {
      const room = await Room.findOne({ roomId });
      if (!room) return;
      const users = room.users;
      const creator = room.creator;
      if (!creator || !users.length) return;
      // Only allow creator to trigger
      // Find socket for creator
      if (socket.userName !== creator) return;
      // Load sentence sets
      const sets = JSON.parse(fs.readFileSync(path.join(__dirname, '../sentenceSets.json'), 'utf8'));
      // Pick a random set
      const chosenSet = sets[Math.floor(Math.random() * sets.length)];
      // Pick a random user (not creator) for second sentence
      const otherUsers = users.filter(u => u !== creator);
      if (otherUsers.length === 0) return; // must have at least one other user
      const chosenUserName = otherUsers[Math.floor(Math.random() * otherUsers.length)];
      // Find socket for chosen user
      let chosenSocketId = null;
      for (let [id, s] of io.of('/').sockets) {
        if (s.rooms.has(roomId) && s.userName === chosenUserName) {
          chosenSocketId = id;
          break;
        }
      }
      // Send first sentence to all
      io.in(roomId).emit('sentence-1', { sentence: chosenSet[0] });
      // Send second sentence to one user only
      if (chosenSocketId) io.to(chosenSocketId).emit('sentence-2', { sentence: chosenSet[1] });
    });

    // Remove user from room only on exit button (custom event)
    socket.on('exit-room', async ({ roomId, userName }) => {
      const room = await Room.findOne({ roomId });
      if (!room) return;
      // Remove user from users array
      room.users = room.users.filter(u => u !== userName);
      if (userName === room.creator) {
        // If creator leaves, delete room
        await Room.deleteOne({ roomId });
        io.in(roomId).emit('all-users', { users: [], creator: null });
      } else {
        await room.save();
        io.in(roomId).emit('all-users', { users: room.users.map(u => ({ userName: u })), creator: room.creator });
        socket.to(roomId).emit('user-left', { userName });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // Handle chat messages
    socket.on('chat-message', async ({ roomId, userName, text }) => {
      io.in(roomId).emit('chat-message', { userName, text });
    });
  });
}

module.exports = socketHandler;
