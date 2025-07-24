const { addUserToRoom, removeUserFromRoom, getUsersInRoom } = require('../utils/roomStore');

function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join-room', ({ roomId, userName }) => {
      socket.join(roomId);
      addUserToRoom(roomId, socket.id, userName);

      // Notify the user of current users in the room
      const users = getUsersInRoom(roomId);
      // Notify all users in the room (including the new user) of the updated user list
      io.in(roomId).emit('all-users', users);

      console.log(`${userName} joined room: ${roomId}`);
    });

    socket.on('disconnecting', () => {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      rooms.forEach(roomId => {
        const user = removeUserFromRoom(roomId, socket.id);
        if (user) {
          socket.to(roomId).emit('user-left', { socketId: socket.id, userName: user.userName });
        }
      });
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // Handle chat messages
    socket.on('chat-message', ({ roomId, userName, text }) => {
      io.in(roomId).emit('chat-message', { userName, text });
    });
  });
}

module.exports = socketHandler;
