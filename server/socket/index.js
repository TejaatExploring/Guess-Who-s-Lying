const Game = require('../models/Room');
const fs = require('fs');
const path = require('path');

// Helper function to save game with retry logic
async function saveGameWithRetry(game, socket, roomId, userName, maxAttempts = 3) {
  let saveAttempts = 0;
  
  while (saveAttempts < maxAttempts) {
    try {
      await game.save();
      return;
    } catch (err) {
      if (err.name === 'VersionError' && saveAttempts < maxAttempts - 1) {
        // Refresh the game document and retry
        const freshGame = await Game.findOne({ gameCode: parseInt(roomId) });
        if (!freshGame) {
          socket.emit('error', { message: 'Game not found' });
          throw new Error('Game not found during retry');
        }
        
        // Re-apply the changes
        const existingPlayer = freshGame.players.find(p => p.name === userName);
        if (existingPlayer) {
          existingPlayer.socketId = socket.id;
          existingPlayer.isConnected = true;
        } else {
          const duplicateName = freshGame.players.some(p => p.name === userName);
          if (duplicateName) {
            socket.emit('error', { message: 'A player with that name already exists in this game' });
            throw new Error('Duplicate player name');
          }
          freshGame.players.push({ 
            name: userName, 
            socketId: socket.id, 
            isConnected: true 
          });
        }
        freshGame.cleanDuplicatePlayers();
        game = freshGame; // Update reference for next iteration
        saveAttempts++;
      } else {
        throw err;
      }
    }
  }
}

function socketHandler(io) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join-room', async ({ roomId, userName }) => {
      socket.userName = userName;
      socket.roomId = roomId;
      socket.join(roomId);

      try {
        let game = await Game.findOne({ gameCode: parseInt(roomId) });
        
        if (!game) {
          // Create new game
          game = new Game({ 
            gameCode: parseInt(roomId), 
            players: [{ name: userName, socketId: socket.id, isConnected: true }],
            gameState: 'waiting'
          });
          await game.save();
          console.log(`New game created: ${roomId} by ${userName}`);
        } else {
          // Find existing player by name (regardless of connection status)
          let existingPlayer = game.players.find(p => p.name === userName);
          
          if (existingPlayer) {
            // Player exists - update their socket ID and mark as connected
            console.log(`${userName} reconnecting to game: ${roomId} - Old socketId: ${existingPlayer.socketId}, New socketId: ${socket.id}`);
            existingPlayer.socketId = socket.id;
            existingPlayer.isConnected = true;
          } else {
            // Check if room is full (only count currently connected players)
            const connectedPlayers = game.players.filter(p => p.isConnected);
            if (connectedPlayers.length >= 6) {
              socket.emit('error', { message: 'Game is full (6 players maximum)' });
              return;
            }
            
            // New player joining
            game.players.push({ 
              name: userName, 
              socketId: socket.id, 
              isConnected: true 
            });
            console.log(`${userName} joined game: ${roomId} as new player`);
          }
          
          // Clean any potential duplicates before saving
          game.cleanDuplicatePlayers();
          
          // Save the game with the updated socket ID
          await game.save();
        }

        // Get fresh game data and emit to all users
        const updatedGame = await Game.findOne({ gameCode: parseInt(roomId) });
        if (updatedGame) {
          const connectedPlayers = updatedGame.players.filter(p => p.isConnected);
          const creator = connectedPlayers.length > 0 ? connectedPlayers[0].name : null;

          io.in(roomId).emit('all-users', {
            users: connectedPlayers.map(p => ({ userName: p.name, socketId: p.socketId })),
            creator: creator,
            gameState: updatedGame.gameState
          });
        }

      } catch (err) {
        console.error(`Error joining room ${roomId}:`, err);
        socket.emit('error', { message: 'Failed to join room. Please try again.' });
      }
    });

    socket.on('start-sentences', async ({ roomId }) => {
      const game = await Game.findOne({ gameCode: parseInt(roomId) });
      if (!game) return;

      const players = game.players.filter(p => p.isConnected);
      const creator = players.length > 0 ? players[0].name : null;
      if (!creator || !players.length) return;

      if (socket.userName !== creator) return;

      // Update game state to 'active'
      game.gameState = 'active';
      await game.save();

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

      // Emit updated game state
      io.in(roomId).emit('game-state-changed', { gameState: 'active' });
    });

    socket.on('exit-room', async ({ roomId, userName }) => {
      try {
        const game = await Game.findOne({ gameCode: parseInt(roomId) });
        if (!game) return;

        // Find the player and mark as disconnected
        const player = game.players.find(p => p.name === userName);
        if (player) {
          player.isConnected = false;
          player.socketId = null;
        }

        // If it's the creator (first player) leaving, delete the game
        if (game.players.length > 0 && game.players[0].name === userName) {
          await Game.deleteOne({ gameCode: parseInt(roomId) });
          io.in(roomId).emit('all-users', { users: [], creator: null });
        } else {
          await game.save();
          // Fetch latest game after save to ensure players array is up to date
          const updatedGame = await Game.findOne({ gameCode: parseInt(roomId) });
          const connectedPlayers = updatedGame ? updatedGame.players.filter(p => p.isConnected) : [];
          const creator = connectedPlayers.length > 0 ? connectedPlayers[0].name : null;
          
          io.in(roomId).emit('all-users', {
            users: connectedPlayers.map(p => ({ userName: p.name })),
            creator: creator,
          });
          io.in(roomId).emit('user-left', { userName });
        }
      } catch (err) {
        console.error(`Error exiting room ${roomId}:`, err);
      }
    });

    socket.on('chat-message', async ({ roomId, userName, text }) => {
      io.in(roomId).emit('chat-message', { userName, text });
    });

    socket.on('get-room-users', async ({ roomId }) => {
      try {
        const game = await Game.findOne({ gameCode: parseInt(roomId) });
        if (game) {
          const connectedPlayers = game.players.filter(p => p.isConnected);
          const creator = connectedPlayers.length > 0 ? connectedPlayers[0].name : null;
          
          socket.emit('room-users', {
            users: connectedPlayers.map(p => ({ userName: p.name, socketId: p.socketId })),
            creator: creator,
          });
        }
      } catch (err) {
        console.error(`Error getting room users for ${roomId}:`, err);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`Client disconnected: ${socket.id}`);
      
      // Handle cleanup when a user disconnects unexpectedly
      if (socket.userName && socket.roomId) {
        try {
          const game = await Game.findOne({ gameCode: parseInt(socket.roomId) });
          
          if (game) {
            const player = game.players.find(p => p.socketId === socket.id);
            if (player) {
              player.isConnected = false;
              player.socketId = null;
              
              // If it's the creator leaving, delete the game
              if (game.players.length > 0 && game.players[0].name === player.name) {
                await Game.deleteOne({ gameCode: parseInt(socket.roomId) });
                socket.to(socket.roomId).emit('all-users', { users: [], creator: null });
                console.log(`Game ${socket.roomId} deleted - creator left`);
              } else {
                await game.save();
                const connectedPlayers = game.players.filter(p => p.isConnected);
                const creator = connectedPlayers.length > 0 ? connectedPlayers[0].name : null;
                
                socket.to(socket.roomId).emit('all-users', {
                  users: connectedPlayers.map(p => ({ userName: p.name, socketId: p.socketId })),
                  creator: creator,
                });
                socket.to(socket.roomId).emit('user-left', { userName: player.name });
                console.log(`${player.name} disconnected from game: ${socket.roomId}`);
              }
            }
          }
        } catch (err) {
          console.error('Error handling disconnect:', err);
        }
      }
    });
  });
}

module.exports = socketHandler;
