#!/bin/sh

# Custom startup script for Azure App Service
# Ensures dependencies are installed before starting the app

echo "Starting BBS application..."

# Change to the application directory
cd /home/site/wwwroot

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install --production
fi

# Set Node.js path
export NODE_PATH=/usr/local/lib/node_modules:$NODE_PATH

# Set default port if not provided
if [ -z "$PORT" ]; then
    export PORT=8080
fi

# Start the application
echo "Starting server on port $PORT..."
if [ -f "server.js" ]; then
    node server.js
elif [ -f "bbs/server.js" ]; then
    node bbs/server.js
else
    echo "ERROR: server.js not found!"
    ls -R
    exit 1
fi
