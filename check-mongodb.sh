#!/bin/bash

echo "🔍 Checking MongoDB setup..."

# Check if MongoDB is installed and running locally
if command -v mongod &> /dev/null; then
    echo "✅ MongoDB is installed locally"
    
    # Check if MongoDB is running
    if pgrep mongod > /dev/null; then
        echo "✅ MongoDB is running"
        echo "📍 Local MongoDB URI: mongodb://localhost:27017/voicechat"
    else
        echo "⚠️  MongoDB is installed but not running"
        echo "💡 Start it with: sudo systemctl start mongod (Linux) or brew services start mongodb/brew/mongodb-community (macOS)"
    fi
else
    echo "❌ MongoDB is not installed locally"
    echo "📚 See MONGODB_SETUP.md for installation instructions"
    echo "🌐 Or use MongoDB Atlas: https://cloud.mongodb.com"
fi

# Test connection to local MongoDB
echo ""
echo "🧪 Testing local MongoDB connection..."
node -e "
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/voicechat', { serverSelectionTimeoutMS: 3000 })
  .then(() => {
    console.log('✅ Successfully connected to local MongoDB');
    process.exit(0);
  })
  .catch((err) => {
    console.log('❌ Could not connect to local MongoDB:', err.message);
    console.log('💡 Consider using MongoDB Atlas for cloud database');
    process.exit(1);
  });
" 2>/dev/null

echo ""
echo "📖 For complete setup instructions, see:"
echo "   - MONGODB_SETUP.md (detailed MongoDB setup)"
echo "   - README.md (general setup instructions)"
echo "   - DEPLOYMENT.md (production deployment)"
