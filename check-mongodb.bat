@echo off
echo 🔍 Checking MongoDB setup...

REM Check if MongoDB is installed locally
where mongod >nul 2>nul
if %errorlevel% == 0 (
    echo ✅ MongoDB is installed locally
    echo 📍 Local MongoDB URI: mongodb://localhost:27017/voicechat
    
    REM Check if MongoDB service is running
    sc query MongoDB >nul 2>nul
    if %errorlevel% == 0 (
        echo ✅ MongoDB service is running
    ) else (
        echo ⚠️  MongoDB is installed but service may not be running
        echo 💡 Start it with: net start MongoDB
    )
) else (
    echo ❌ MongoDB is not installed locally
    echo 📚 See MONGODB_SETUP.md for installation instructions
    echo 🌐 Or use MongoDB Atlas: https://cloud.mongodb.com
)

echo.
echo 🧪 Testing local MongoDB connection...
cd server
node -e "const mongoose = require('mongoose'); mongoose.connect('mongodb://localhost:27017/voicechat', { serverSelectionTimeoutMS: 3000 }).then(() => { console.log('✅ Successfully connected to local MongoDB'); process.exit(0); }).catch((err) => { console.log('❌ Could not connect to local MongoDB:', err.message); console.log('💡 Consider using MongoDB Atlas for cloud database'); process.exit(1); });" 2>nul
cd ..

echo.
echo 📖 For complete setup instructions, see:
echo    - MONGODB_SETUP.md (detailed MongoDB setup)
echo    - README.md (general setup instructions)
echo    - DEPLOYMENT.md (production deployment)
pause
