const rooms = {};

function addUserToRoom(roomId, socketId, userName) {
  if (!rooms[roomId]) rooms[roomId] = {};
  rooms[roomId][socketId] = { userName };
}

function removeUserFromRoom(roomId, socketId) {
  if (!rooms[roomId]) return null;
  const user = rooms[roomId][socketId];
  delete rooms[roomId][socketId];
  if (Object.keys(rooms[roomId]).length === 0) delete rooms[roomId];
  return user;
}

function getUsersInRoom(roomId) {
  return rooms[roomId] ? Object.entries(rooms[roomId]).map(([id, data]) => ({
    socketId: id,
    userName: data.userName,
  })) : [];
}

module.exports = {
  addUserToRoom,
  removeUserFromRoom,
  getUsersInRoom,
};
