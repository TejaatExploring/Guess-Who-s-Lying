const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  socketId: {
    type: String,
    default: null
  },
  isConnected: {
    type: Boolean,
    default: false
  }
});

const gameSchema = new mongoose.Schema({
  gameCode: {
    type: Number,
    required: true,
    unique: true
  },
  players: {
    type: [playerSchema],
    validate: [
      {
        validator: function(arr) {
          return arr.length <= 6;
        },
        message: '{PATH} exceeds the limit of 6'
      }
    ],
    default: []
  },
  gameState: {
    type: String,
    enum: ['waiting', 'starting', 'active', 'ended'],
    default: 'waiting'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save middleware to clean duplicates
gameSchema.pre('save', function() {
  this.cleanDuplicatePlayers();
});

// Method to clean duplicate players
gameSchema.methods.cleanDuplicatePlayers = function() {
  const uniquePlayers = [];
  const seenNames = new Set();
  
  for (const player of this.players) {
    if (!seenNames.has(player.name)) {
      uniquePlayers.push(player);
      seenNames.add(player.name);
    }
  }
  
  this.players = uniquePlayers;
  return this;
};

module.exports = mongoose.model('Game', gameSchema);
