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

  // Helper function to emit clean user lists consistently
  async function emitCleanUserList(roomId, gameState = null, forceRetainCreator = false) {
    try {
      const game = await Game.findOne({ gameCode: parseInt(roomId) });
      if (!game) return;
      
      // Clean stale connections but be more conservative during creator reconnection
      const hasStaleConnections = cleanStaleConnections(game, io);
      if (hasStaleConnections) {
        await game.save();
        console.log(`Cleaned stale connections for room ${roomId}`);
      }
      
      const connectedPlayers = game.players.filter(p => p.isConnected);
      
      // Better creator detection logic - preserve original creator when possible
      let creatorPlayer;
      if (forceRetainCreator) {
        // During reconnection, prefer the original creator if they exist in any state
        creatorPlayer = game.players.find(p => p.isCreator) || connectedPlayers[0];
      } else {
        // Normal operation - find connected creator or fallback
        creatorPlayer = connectedPlayers.find(p => p.isCreator) || connectedPlayers[0];
      }
      
      const creator = creatorPlayer ? creatorPlayer.name : null;
      
      const payload = {
        users: connectedPlayers.map(p => ({ userName: p.name, socketId: p.socketId })),
        creator: creator,
        totalPlayers: game.players.length, // Include total player count for persistence
        connectedCount: connectedPlayers.length
      };
      
      if (gameState !== null) {
        payload.gameState = gameState;
      } else {
        payload.gameState = game.gameState;
      }
      
      console.log(`Emitting clean user list for room ${roomId}:`, connectedPlayers.map(p => `${p.name}(${p.socketId})`));
      
      io.in(roomId).emit('all-users', payload);
      return game;
    } catch (err) {
      console.error(`Error emitting clean user list for room ${roomId}:`, err);
      return null;
    }
  }

  // Periodic cleanup of stale connections (every 15 seconds for better real-time experience)
  setInterval(async () => {
    try {
      const games = await Game.find({});
      for (const game of games) {
        const hasStaleConnections = cleanStaleConnections(game, io);
        if (hasStaleConnections) {
          await game.save();
          console.log(`Cleaned stale connections for game ${game.gameCode}`);
          
          // Notify all users in the room of the updated user list
          await emitCleanUserList(game.gameCode.toString());
        }
      }
    } catch (err) {
      console.error('Error during periodic cleanup:', err);
    }
  }, 15 * 1000); // 15 seconds

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    // Heartbeat mechanism for better connection monitoring
    socket.on('heartbeat', ({ roomId, userName }) => {
      // Update last seen timestamp for this user in database
      Game.findOne({ gameCode: parseInt(roomId) })
        .then(game => {
          if (game) {
            const player = game.players.find(p => p.name === userName && p.socketId === socket.id);
            if (player) {
              player.lastSeen = new Date();
              return game.save();
            }
          }
        })
        .catch(err => console.error('Error updating heartbeat:', err));
    });
    
    // Check if a room exists (for join validation)
    socket.on('check-room-exists', async ({ roomId }, callback) => {
      try {
        // Room/gameCode is stored as a number, so parse roomId
        const game = await Game.findOne({ gameCode: Number(roomId) });
        callback({ exists: !!game });
      } catch (err) {
        callback({ exists: false });
      }
    });
    
    // When a client connects, clean up any stale connections they might have left behind
    socket.on('cleanup-stale-connection', async ({ roomId, userName }) => {
      try {
        const game = await Game.findOne({ gameCode: parseInt(roomId) });
        if (game) {
          // Find any old connections for this user and mark them as disconnected
          const oldConnections = game.players.filter(p => p.name === userName && p.socketId !== socket.id && p.isConnected);
          if (oldConnections.length > 0) {
            oldConnections.forEach(p => {
              p.isConnected = false;
              p.socketId = null;
              console.log(`Cleaned old connection for ${userName}: ${p.socketId}`);
            });
            await game.save();
            await emitCleanUserList(roomId);
          }
        }
      } catch (err) {
        console.error(`Error cleaning stale connection for ${userName} in room ${roomId}:`, err);
      }
    });

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
              players: [{ name: userName, socketId: socket.id, isConnected: true, isCreator: true }],
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
        let isCreatorReconnecting = false;
        
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
              // Player exists - check if they were the creator
              isCreatorReconnecting = existingPlayer.isCreator;
              
              // Player exists - update their socket ID and mark as connected
              if (existingPlayer.socketId !== socket.id) {
                console.log(`${userName} reconnecting to game: ${roomId} - Old socketId: ${existingPlayer.socketId}, New socketId: ${socket.id}`);
                existingPlayer.socketId = socket.id;
                existingPlayer.isConnected = true;
                // Preserve their creator status if they had it
                console.log(`${userName} reconnected as ${existingPlayer.isCreator ? 'creator' : 'player'}`);
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
              const isFirstPlayer = freshGame.players.length === 0;
              // If no connected creator exists, make this player the creator
              const connectedCreator = freshGame.players.find(p => p.isCreator && p.isConnected);
              const shouldBeCreator = isFirstPlayer || !connectedCreator;
              
              freshGame.players.push({ 
                name: userName, 
                socketId: socket.id, 
                isConnected: true,
                isCreator: shouldBeCreator
              });
              console.log(`${userName} joined game: ${roomId} as ${shouldBeCreator ? 'creator' : 'new player'}`);
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

        // Emit clean user list to all users in the room
        await emitCleanUserList(roomId, null, isCreatorReconnecting);
        
        // If creator is reconnecting, send a special reconnection notice
        if (isCreatorReconnecting) {
          console.log(`Creator ${userName} reconnected to room ${roomId}`);
          io.in(roomId).emit('creator-reconnected', { 
            message: 'Creator has reconnected',
            creatorName: userName,
            shouldRebuildConnections: true
          });
        }
        
        // Emit a special event to trigger WebRTC mesh rebuild with delay for better stability
        setTimeout(() => {
          io.in(roomId).emit('webrtc-mesh-refresh', { 
            message: `A user has ${isCreatorReconnecting ? 'reconnected' : 'joined'}, refreshing voice connections...`,
            rejoinedUser: userName,
            isCreatorReconnecting: isCreatorReconnecting
          });
        }, isCreatorReconnecting ? 1000 : 500); // Longer delay for creator reconnection

      } catch (err) {
        console.error(`Error joining room ${roomId}:`, err);
        socket.emit('error', { message: 'Failed to join room. Please try again.' });
      }
    });

    socket.on('start-sentences', async ({ roomId }) => {
      const game = await Game.findOne({ gameCode: parseInt(roomId) });
      if (!game) return;

      const players = game.players.filter(p => p.isConnected);
      const creatorPlayer = players.find(p => p.isCreator);
      const creator = creatorPlayer ? creatorPlayer.name : null;
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

        // If it's the creator leaving permanently (not refreshing), handle appropriately
        if (player && player.isCreator) {
          // Check if there are other connected players
          const otherConnectedPlayers = game.players.filter(p => p.isConnected && p.name !== userName);
          
          if (otherConnectedPlayers.length > 0) {
            // Transfer creator role to the next connected player
            const newCreator = otherConnectedPlayers[0];
            newCreator.isCreator = true;
            player.isCreator = false; // Remove creator status from leaving player
            
            await game.save();
            
            console.log(`Creator ${userName} left, transferring role to ${newCreator.name} in game ${roomId}`);
            
            // Notify all users of the creator change
            io.in(roomId).emit('creator-changed', { 
              newCreator: newCreator.name,
              message: `${newCreator.name} is now the game creator`
            });
            
            await emitCleanUserList(roomId);
            io.in(roomId).emit('user-left', { userName });
          } else {
            // No other players, delete the game
            await Game.deleteOne({ gameCode: parseInt(roomId) });
            io.in(roomId).emit('all-users', { users: [], creator: null });
            console.log(`Game ${roomId} deleted - creator exited and no other players`);
          }
        } else {
          await game.save();
          // Emit clean user list to all users in the room
          await emitCleanUserList(roomId);
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
              
              // If it's the creator leaving due to refresh/disconnect, handle gracefully
              if (player.isCreator) {
                console.log(`Creator ${player.name} disconnected from game ${socket.roomId} - waiting for potential reconnection`);
                
                // Don't immediately delete the game, wait for potential reconnection
                // But mark as disconnected for now
                await game.save();
                
                // Emit updated user list but keep the game alive
                await emitCleanUserList(socket.roomId);
                
                // Notify other players that creator disconnected but game continues
                socket.to(socket.roomId).emit('creator-disconnected', { 
                  creatorName: player.name,
                  message: 'Creator disconnected but may reconnect. Game continues...'
                });
                
                socket.to(socket.roomId).emit('user-left', { userName: player.name });
                
                // Set a longer timeout to delete the game only if creator doesn't reconnect
                setTimeout(async () => {
                  try {
                    const freshGame = await Game.findOne({ gameCode: parseInt(socket.roomId) });
                    if (freshGame) {
                      const creatorPlayer = freshGame.players.find(p => p.name === player.name);
                      // If creator is still not connected after 30 seconds, handle appropriately
                      if (creatorPlayer && !creatorPlayer.isConnected) {
                        const otherConnectedPlayers = freshGame.players.filter(p => p.isConnected && p.name !== player.name);
                        
                        if (otherConnectedPlayers.length > 0) {
                          // Transfer creator role to another player
                          const newCreator = otherConnectedPlayers[0];
                          newCreator.isCreator = true;
                          creatorPlayer.isCreator = false;
                          
                          await freshGame.save();
                          
                          console.log(`Creator ${player.name} did not reconnect, transferring role to ${newCreator.name}`);
                          
                          io.in(socket.roomId).emit('creator-changed', { 
                            newCreator: newCreator.name,
                            message: `${newCreator.name} is now the game creator`
                          });
                          
                          await emitCleanUserList(socket.roomId);
                        } else {
                          // No other players, delete the game
                          await Game.deleteOne({ gameCode: parseInt(socket.roomId) });
                          io.in(socket.roomId).emit('game-ended', { 
                            message: 'Game ended - creator left and no other players remaining'
                          });
                          console.log(`Game ${socket.roomId} deleted - creator left and no other players after timeout`);
                        }
                      }
                    }
                  } catch (err) {
                    console.error('Error in creator timeout handler:', err);
                  }
                }, 30000); // 30 second grace period for creator to reconnect
                
              } else {
                await game.save();
                // Emit clean user list to all users in the room
                await emitCleanUserList(socket.roomId);
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
