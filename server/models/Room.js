const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  creator: { type: String, required: true },
  users: [{ type: String }]
});

module.exports = mongoose.model('Room', RoomSchema);
