const mongoose = require('mongoose');
const Game = require('./models/Room');
require('dotenv').config();

async function cleanupDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/voicechat');
    console.log('Connected to MongoDB');

    console.log('Finding games with duplicate players...');
    const games = await Game.find({});
    
    let cleanedCount = 0;
    for (const game of games) {
      const originalPlayerCount = game.players.length;
      game.cleanDuplicatePlayers();
      
      if (game.players.length !== originalPlayerCount) {
        console.log(`Game ${game.gameCode}: Cleaned ${originalPlayerCount - game.players.length} duplicate players`);
        await game.save();
        cleanedCount++;
      }
    }

    console.log(`\nCleanup complete! Processed ${games.length} games, cleaned ${cleanedCount} games.`);
    
    // Also remove disconnected players from old games
    console.log('\nRemoving disconnected players from old games...');
    const result = await Game.updateMany(
      {},
      { $pull: { players: { isConnected: false } } }
    );
    console.log(`Removed disconnected players from ${result.modifiedCount} games`);

    // Remove empty games
    console.log('\nRemoving empty games...');
    const deleteResult = await Game.deleteMany({ 
      $or: [
        { players: { $size: 0 } },
        { players: { $not: { $elemMatch: { isConnected: true } } } }
      ]
    });
    console.log(`Deleted ${deleteResult.deletedCount} empty games`);

    await mongoose.disconnect();
    console.log('\nDatabase cleanup completed successfully!');
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupDatabase();
