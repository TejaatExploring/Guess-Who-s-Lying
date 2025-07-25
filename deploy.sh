#!/bin/bash

# Deploy script for Voice Chat App
echo "🚀 Starting deployment process..."

# Check if we're in the right directory
if [ ! -f "DEPLOYMENT.md" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

echo "📦 Installing dependencies..."

# Install server dependencies
echo "Installing server dependencies..."
cd server
npm install
cd ..

# Install client dependencies
echo "Installing client dependencies..."
cd client
npm install
cd ..

echo "✅ Dependencies installed successfully!"

echo "🔧 Please complete the following steps manually:"
echo "1. Set up MongoDB Atlas cluster"
echo "2. Update .env files with your production URLs"
echo "3. Deploy server to Vercel: cd server && vercel --prod"
echo "4. Deploy client to Vercel: cd client && vercel --prod"
echo "5. Update environment variables in Vercel dashboard"

echo "📚 See DEPLOYMENT.md for detailed instructions"
