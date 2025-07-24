const { addUserToRoom, removeUserFromRoom, getUsersInRoom } = require('../utils/roomStore');

function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join-room', ({ roomId, userName }) => {
      socket.join(roomId);
      addUserToRoom(roomId, socket.id, userName);

      // Notify the user of current users in the room
      const users = getUsersInRoom(roomId);
      socket.emit('all-users', users);

      // Notify others that a new user has joined
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userName,
      });

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
  });
}

module.exports = socketHandler;
