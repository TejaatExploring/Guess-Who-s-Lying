const Game = require('../models/Room');
const fs = require('fs');
const path = require('path');

function socketHandler(io) {
  // Helper function to clean stale connections
  function cleanStaleConnections(game, io) {
    const activeSocketIds = Array.from(io.sockets.sockets.keys());
    let hasChanges = false;
    
    game.players.forEach(player => {
      if (player.socketId && player.isConnected && !activeSocketIds.includes(player.socketId)) {
        console.log(`Cleaning stale connection for ${player.name}: ${player.socketId}`);
        player.isConnected = false;
        player.socketId = null;
        hasChanges = true;
      }
    });
    
    return hasChanges;
  }

  // Periodic cleanup of stale connections (every 5 minutes)
  setInterval(async () => {
    try {
      const games = await Game.find({});
      for (const game of games) {
        const hasStaleConnections = cleanStaleConnections(game, io);
        if (hasStaleConnections) {
          await game.save();
          console.log(`Cleaned stale connections for game ${game.gameCode}`);
        }
      }
    } catch (err) {
      console.error('Error during periodic cleanup:', err);
    }
  }, 5 * 60 * 1000); // 5 minutes

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('join-room', async ({ roomId, userName }) => {
      // Prevent duplicate joins from same socket
      if (socket.hasJoinedRoom) {
        console.log(`Socket ${socket.id} already joined room, ignoring duplicate join`);
        return;
      }

      socket.userName = userName;
      socket.roomId = roomId;
      socket.hasJoinedRoom = true;
      socket.join(roomId);

      try {
        // Use findOneAndUpdate with upsert for atomic operations
        let game = await Game.findOne({ gameCode: parseInt(roomId) });
        
        if (!game) {
          // Try to create new game atomically
          try {
            game = new Game({ 
              gameCode: parseInt(roomId), 
              players: [{ name: userName, socketId: socket.id, isConnected: true }],
              gameState: 'waiting'
            });
            await game.save();
            console.log(`New game created: ${roomId} by ${userName}`);
          } catch (createErr) {
            // If game was created by another request, fetch it
            if (createErr.code === 11000) {
              game = await Game.findOne({ gameCode: parseInt(roomId) });
              if (!game) {
                socket.emit('error', { message: 'Failed to create or join game' });
                return;
              }
            } else {
              throw createErr;
            }
          }
        }

        // Use retry logic for updates
        let retryCount = 0;
        const maxRetries = 5;
        
        while (retryCount < maxRetries) {
          try {
            // Refresh game data for each attempt
            const freshGame = await Game.findOne({ gameCode: parseInt(roomId) });
            if (!freshGame) {
              socket.emit('error', { message: 'Game not found' });
              return;
            }

            // Find existing player by name
            let existingPlayer = freshGame.players.find(p => p.name === userName);
            
            if (existingPlayer) {
              // Player exists - update their socket ID and mark as connected
              if (existingPlayer.socketId !== socket.id) {
                console.log(`${userName} reconnecting to game: ${roomId} - Old socketId: ${existingPlayer.socketId}, New socketId: ${socket.id}`);
                existingPlayer.socketId = socket.id;
                existingPlayer.isConnected = true;
              } else {
                console.log(`${userName} already connected to game: ${roomId} with socketId: ${socket.id}`);
                existingPlayer.isConnected = true;
              }
            } else {
              // Check if room is full (only count currently connected players)
              const connectedPlayers = freshGame.players.filter(p => p.isConnected);
              if (connectedPlayers.length >= 6) {
                socket.emit('error', { message: 'Game is full (6 players maximum)' });
                return;
              }
              
              // New player joining
              freshGame.players.push({ 
                name: userName, 
                socketId: socket.id, 
                isConnected: true 
              });
              console.log(`${userName} joined game: ${roomId} as new player`);
            }
            
            // Clean duplicates before saving
            freshGame.cleanDuplicatePlayers();
            
            // Try to save
            await freshGame.save();
            break; // Success, exit retry loop
            
          } catch (saveErr) {
            retryCount++;
            if (saveErr.name === 'VersionError' && retryCount < maxRetries) {
              console.log(`Version conflict for ${userName} in room ${roomId}, retrying... (${retryCount}/${maxRetries})`);
              // Small delay before retry
              await new Promise(resolve => setTimeout(resolve, 50 * retryCount));
              continue;
            } else {
              throw saveErr;
            }
          }
        }

        if (retryCount >= maxRetries) {
          socket.emit('error', { message: 'Failed to join room due to high traffic. Please try again.' });
          return;
        }

        // Get fresh game data and emit to all users
        const updatedGame = await Game.findOne({ gameCode: parseInt(roomId) });
        if (updatedGame) {
          const connectedPlayers = updatedGame.players.filter(p => p.isConnected);
          const creator = connectedPlayers.length > 0 ? connectedPlayers[0].name : null;

          console.log(`Emitting user list for room ${roomId}:`, connectedPlayers.map(p => `${p.name}(${p.socketId})`));

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
        // Reset join flag
        socket.hasJoinedRoom = false;
        
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
          console.log(`Game ${roomId} deleted - creator exited`);
        } else {
          await game.save();
          // Fetch latest game after save to ensure players array is up to date
          const updatedGame = await Game.findOne({ gameCode: parseInt(roomId) });
          const connectedPlayers = updatedGame ? updatedGame.players.filter(p => p.isConnected) : [];
          const creator = connectedPlayers.length > 0 ? connectedPlayers[0].name : null;
          
          io.in(roomId).emit('all-users', {
            users: connectedPlayers.map(p => ({ userName: p.name, socketId: p.socketId })),
            creator: creator,
          });
          io.in(roomId).emit('user-left', { userName });
          console.log(`${userName} exited game: ${roomId}`);
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
          // Clean stale connections before sending user list
          const hasStaleConnections = cleanStaleConnections(game, io);
          if (hasStaleConnections) {
            await game.save();
          }
          
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
      
      // Reset join flag
      socket.hasJoinedRoom = false;
      
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
