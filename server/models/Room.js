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
    } else {
      // If duplicate found, keep the most recent connected one
      const existingPlayerIndex = uniquePlayers.findIndex(p => p.name === player.name);
      if (existingPlayerIndex !== -1) {
        const existingPlayer = uniquePlayers[existingPlayerIndex];
        
        // Priority: Connected player > Player with socketId > Most recent
        if (player.isConnected && !existingPlayer.isConnected) {
          // New player is connected, existing is not - replace
          uniquePlayers[existingPlayerIndex] = player;
        } else if (player.isConnected && existingPlayer.isConnected) {
          // Both connected, keep the one with the most recent socketId (non-null)
          if (player.socketId && !existingPlayer.socketId) {
            uniquePlayers[existingPlayerIndex] = player;
          }
        } else if (!player.isConnected && !existingPlayer.isConnected) {
          // Both disconnected, keep the one with most recent socketId
          if (player.socketId && !existingPlayer.socketId) {
            uniquePlayers[existingPlayerIndex] = player;
          }
        }
        // If existing player is connected and new is not, keep existing (no change needed)
      }
    }
  }
  
  this.players = uniquePlayers;
  return this;
};

// Method to add player safely
gameSchema.methods.addPlayerSafely = function(playerData) {
  // Remove any existing player with the same name first
  this.players = this.players.filter(p => p.name !== playerData.name);
  // Add the new player
  this.players.push(playerData);
  return this;
};

// Method to update player socket ID
gameSchema.methods.updatePlayerSocketId = function(playerName, newSocketId) {
  const player = this.players.find(p => p.name === playerName);
  if (player) {
    const oldSocketId = player.socketId;
    player.socketId = newSocketId;
    player.isConnected = true;
    console.log(`Updated ${playerName}: ${oldSocketId} -> ${newSocketId}`);
    return true;
  }
  return false;
};

module.exports = mongoose.model('Game', gameSchema);
