const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  socketId: { type: String, required: true },
  userName: { type: String, required: true },
  roomId: { type: String, required: true }
});

module.exports = mongoose.model('User', UserSchema);
