# MongoDB Setup Guide

## Option 1: Local MongoDB (Recommended for Development)

### Install MongoDB Locally

**Windows:**
1. Download MongoDB Community Server from https://www.mongodb.com/try/download/community
2. Install with default settings
3. MongoDB will run on `mongodb://localhost:27017`

**macOS (using Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb/brew/mongodb-community
```

**Linux (Ubuntu/Debian):**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

### Use Local MongoDB
Your `.env` file should have:
```
MONGO_URI=mongodb://localhost:27017/voicechat
```

## Option 2: MongoDB Atlas (Cloud Database)

### Setup MongoDB Atlas

1. **Create Account**: Go to https://cloud.mongodb.com and sign up
2. **Create Cluster**: 
   - Choose "Free Shared" tier
   - Select your preferred region
   - Name your cluster (e.g., "voice-chat-cluster")
3. **Database Access**:
   - Go to "Database Access" in sidebar
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create username/password (save these!)
   - Grant "Read and write to any database" privileges
4. **Network Access**:
   - Go to "Network Access" in sidebar
   - Click "Add IP Address"
   - Choose "Allow Access from Anywhere" (0.0.0.0/0) for development
   - For production, use specific IP addresses
5. **Get Connection String**:
   - Go to "Clusters" and click "Connect"
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `voicechat`

### Use MongoDB Atlas
Your `.env` file should have:
```
MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/voicechat?retryWrites=true&w=majority
```

Example:
```
MONGO_URI=mongodb+srv://john:mypassword123@voice-chat-cluster.abc123.mongodb.net/voicechat?retryWrites=true&w=majority
```

## Quick Start

For immediate development, use Option 1 (Local MongoDB) as it's faster to set up.
For production deployment, use Option 2 (MongoDB Atlas).

## Troubleshooting

### Common Issues:

1. **ENOTFOUND Error**: Your connection string has placeholder values
   - Make sure to replace ALL placeholder values with actual credentials

2. **Authentication Failed**: Wrong username/password
   - Double-check your database user credentials in MongoDB Atlas

3. **Network Timeout**: IP not whitelisted
   - Add your IP address to Network Access in MongoDB Atlas

4. **Local MongoDB Not Running**:
   - Windows: Check MongoDB service is running
   - macOS: `brew services restart mongodb/brew/mongodb-community`
   - Linux: `sudo systemctl status mongod`

### Test Your Connection

You can test your MongoDB connection using MongoDB Compass (GUI tool) or mongo shell:

```bash
# Test local connection
mongo mongodb://localhost:27017/voicechat

# Test Atlas connection
mongo "mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/voicechat"
```
