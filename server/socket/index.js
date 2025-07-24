const Room = require('../models/Room');
const fs = require('fs');
const path = require('path');

function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join-room', async ({ roomId, userName }) => {
      socket.userName = userName; // Assign userName to socket
      socket.join(roomId);

      let room = await Room.findOne({ roomId });
      if (!room) {
        // First user is creator
        try {
          room = await Room.create({ roomId, creator: userName, users: [userName] });
        } catch (err) {
          if (err.code === 11000) {
            room = await Room.findOne({ roomId });
          } else {
            throw err;
          }
        }
      } else {
        await Room.updateOne({ roomId }, { $addToSet: { users: userName } });
      }

      room = await Room.findOne({ roomId });
      if (!room.users.length) {
        room.users = [room.creator];
        await room.save();
      }

      io.in(roomId).emit('all-users', {
        users: room.users.map(u => ({ userName: u })),
        creator: room.creator,
      });

      console.log(`${userName} joined room: ${roomId}`);
    });

    socket.on('start-sentences', async ({ roomId }) => {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      const users = room.users;
      const creator = room.creator;
      if (!creator || !users.length) return;

      if (socket.userName !== creator) return;

      const sets = JSON.parse(fs.readFileSync(path.join(__dirname, '../sentenceSets.json'), 'utf8'));
      const chosenSet = sets[Math.floor(Math.random() * sets.length)];

      const connectedSockets = Array.from(io.of('/').sockets.values()).filter(s => s.rooms.has(roomId));
      if (connectedSockets.length === 0) return;

      const chosenSocket = connectedSockets[Math.floor(Math.random() * connectedSockets.length)];

      // Send first sentence to all except chosenSocket
      connectedSockets.forEach(s => {
        if (s === chosenSocket) {
          s.emit('sentence-2', { sentence: chosenSet[1] });
        } else {
          s.emit('sentence-1', { sentence: chosenSet[0] });
        }
      });
    });

    socket.on('exit-room', async ({ roomId, userName }) => {
      const room = await Room.findOne({ roomId });
      if (!room) return;

      room.users = room.users.filter(u => u !== userName);

      if (userName === room.creator) {
        await Room.deleteOne({ roomId });
        io.in(roomId).emit('all-users', { users: [], creator: null });
      } else {
        await room.save();
        io.in(roomId).emit('all-users', {
          users: room.users.map(u => ({ userName: u })),
          creator: room.creator,
        });
        socket.to(roomId).emit('user-left', { userName });
      }
    });

    socket.on('chat-message', async ({ roomId, userName, text }) => {
      io.in(roomId).emit('chat-message', { userName, text });
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

module.exports = socketHandler;
