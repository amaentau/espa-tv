# Espa-TV (Clean)

This repository includes only the parts required to run and publish a clean version of the project:

- `bbs/`: Azure App Service bulletin board (Express + Azure Table Storage)
- `raspberry-pi/`: Node.js app that fetches the latest Veo stream from the BBS and opens it in Chromium on a Raspberry Pi

All legacy/experimental components and local binaries are removed or ignored.

## Quick start

### Azure BBS service (`bbs/`)
```bash
cd bbs
npm install

# Required env vars
export STORAGE_CONNECTION_STRING="<your-azure-storage-connection-string>"
export TABLE_NAME="bbsEntries"   # optional, defaults to bbsEntries

# Run locally
npm start

# Deploy (example)
bash deploy-azure.sh   # or deploy with your preferred Azure method
```

Endpoints:
- `POST /entry` — write `{ key, value1, value2 }`
- `GET  /entries/:key` — read latest entries for a key (newest first)

### Raspberry Pi app (`raspberry-pi/`)
```bash
cd raspberry-pi
npm install

# Configure BBS URL in config (see config.example.js)
# azure.bbsUrl: e.g. https://espa-tv.azurewebsites.net

# Run
./run.sh      # or: node src/index.js
```

Notes:
- `raspberry-pi/config.json` is intentionally ignored; use `config.example.js` as a template
- First request to a Free-tier Azure App may be slow while the app wakes up

## Repository structure
```
./
├─ bbs/            # Azure bulletin board service
├─ raspberry-pi/   # Raspberry Pi viewer/launcher
└─ docs/           # Documentation
```

## Security
- Never commit credentials or local config. The repo ignores `raspberry-pi/config.json` and common secret files.
- Provide secrets via environment variables or local, ignored files.

## License
MIT

---

# Espa-TV - Cleaned Workspace

This repo is focused on two active components:

- bbs/ — Azure App Service + Azure Table Storage bulletin board
- raspberry-pi/ — Node.js + Puppeteer app for playback on Raspberry Pi

Legacy and experimental components were moved to archive/legacy/.

Root npm scripts were simplified to only bbs and raspberry-pi.

---

Legacy documentation below:

# Espa-TV - Complete IoT Streaming Solution

A comprehensive IoT solution for streaming Veo content with cloud-based device management and mobile control.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Cloud Service │    │ Raspberry Pi    │
│  (React Native) │◄──►│    (Azure)      │◄──►│   (Device)      │
│                 │    │                 │    │                 │
│ • Device Discovery│   │ • Device Mgmt    │   │ • Stream Player │
│ • URL Input      │   │ • Command Routing │   │ • Auto Fullscreen│
│ • Remote Control │   │ • Real-time Comm  │   │ • Cloud Reg     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### 1. Deploy Cloud Service (Azure)

```bash
# Navigate to cloud directory
cd cloud

# Generate Azure deployment files
node azure-deploy.js

# Deploy to Azure (choose one method):
# Method 1: PowerShell (Windows)
.\deploy-azure.ps1 -ResourceGroupName "veo-dongle-rg" -AppServiceName "veo-dongle-cloud"

# Method 2: Bash (Linux/Mac)
bash deploy-azure.sh

# Method 3: Manual Azure CLI
az webapp up --name veo-dongle-cloud --resource-group veo-dongle-rg --location "East US"
```

### 2. Configure Raspberry Pi

```bash
# Install dependencies
cd raspberry-pi
npm install

# Set cloud service URL
export CLOUD_URL="https://your-azure-app.azurewebsites.net"
export DEVICE_ID="raspberry-pi-001"

# Run with cloud registration
./run.sh
```

### 3. Mobile App Setup

```bash
# Install dependencies
cd mobile
npm install

# Update cloud service URL in DeviceService.js
# Change: this.baseUrl = 'http://localhost:4000';
# To: this.baseUrl = 'https://your-azure-app.azurewebsites.net';

# Run the app
npm run android  # or npm run ios
```

## 📱 Mobile App Features

### Device Discovery
- Automatically discovers Raspberry Pi devices via cloud service
- Real-time device status monitoring
- Pull-to-refresh device list

### Stream URL Management
- Dedicated screen for entering Veo stream URLs
- URL validation and error handling
- Example URL pre-fill option
- Send URLs to devices with automatic playback

### Device Control
- Play/Pause controls
- Fullscreen toggle
- Real-time status updates
- Connection status indicators

## ☁️ Cloud Service Features

### Device Management
- Device registration and discovery
- Real-time device status tracking
- Command routing between mobile and devices

### API Endpoints
```
GET  /health           # Service health check
GET  /devices          # List all devices
GET  /devices/:id/status # Get device status
POST /control/:id/play # Send play command
POST /control/:id/pause # Send pause command
POST /control/:id/fullscreen # Send fullscreen command
POST /control/:id/stream # Send Veo URL for streaming
```

### WebSocket Events
- `register` - Device registration
- `mobile-command` - Commands from mobile app
- `stream-url` - Stream URL updates
- `status` - Device status updates

## 🍓 Raspberry Pi Features

### Automatic Streaming
- Login detection and authentication
- Stream URL navigation with retry logic
- Automatic fullscreen activation
- Intelligent playback start

### Cloud Integration
- Auto-registration with cloud service
- Real-time command handling
- Dynamic stream URL updates
- Status reporting

### Robust Control
- Multiple fullscreen methods (coordinates, JS API, browser)
- Multiple playback methods (coordinates, HTML5 video, buttons)
- Error handling and fallback mechanisms
- WebSocket server for local control

## 🔧 Configuration

### Environment Variables

#### Cloud Service
```bash
NODE_ENV=production
PORT=8080
MONGODB_URI=mongodb://localhost:27017/veo-dongle
```

#### Raspberry Pi
```bash
CLOUD_URL=https://your-azure-app.azurewebsites.net
DEVICE_ID=raspberry-pi-001
PORT=3000
VEO_STREAM_URL=https://live.veo.co/stream/...
```

### Config Files

#### Raspberry Pi Config (`config.json`)
```json
{
  "veoStreamUrl": "https://live.veo.co/stream/...",
  "port": 3000,
  "cloudUrl": "http://localhost:4000",
  "login": {
    "url": "https://live.veo.co/login",
    "enabled": true
  },
  "coordinates": {
    "fullscreen": { "x": 1765, "y": 1045 },
    "playback": { "x": 45, "y": 1052 }
  }
}
```

## 🔐 Security Features

- HTTPS support for cloud service
- Device authentication
- CORS protection
- Helmet.js security headers
- Input validation and sanitization

## 📊 Monitoring & Logging

- Real-time device status monitoring
- Comprehensive error logging
- Health check endpoints
- Connection status tracking
- Command execution feedback

## 🐛 Troubleshooting

### Common Issues

**Mobile App Can't Find Devices:**
- Check cloud service URL in DeviceService.js
- Ensure cloud service is running and accessible
- Verify Raspberry Pi is registered with cloud

**Stream Won't Start:**
- Check credentials.json is properly formatted
- Verify Veo URL is valid and accessible
- Check browser console for Puppeteer errors

**Cloud Service Connection Issues:**
- Verify Azure deployment completed successfully
- Check firewall settings
- Review Azure App Service logs

### Debug Mode

Enable debug logging:
```bash
# Raspberry Pi
DEBUG=* ./run.sh

# Cloud Service
DEBUG=* npm start
```

## 🚀 Deployment Options

### Azure App Service (Recommended)
- Free tier available
- Auto-scaling
- Built-in monitoring
- Global CDN

### Docker Deployment
```bash
# Build and run cloud service
docker build -t veo-dongle-cloud .
docker run -p 4000:8080 veo-dongle-cloud

# Raspberry Pi with Docker
docker build -t veo-dongle-pi .
docker run --privileged veo-dongle-pi
```

### Local Development
```bash
# Start cloud service
cd cloud && npm start

# Start Raspberry Pi (new terminal)
cd raspberry-pi && ./run.sh

# Start mobile app (new terminal)
cd mobile && npm run android
```

## 📝 API Reference

### Mobile App API
```javascript
import DeviceService from './services/DeviceService';

// Connect to cloud
await DeviceService.connect();

// Get devices
const devices = await DeviceService.getDevices();

// Send command
await DeviceService.sendCommand(deviceId, 'play');

// Send stream URL
await DeviceService.sendCommand(deviceId, 'stream', { veoUrl: 'https://...' });
```

### Device Control API
```javascript
// Direct device control (when connected locally)
fetch('http://raspberry-pi:3000/control/play', { method: 'POST' });

// Via cloud service
fetch('https://your-cloud.azurewebsites.net/control/device-123/play', { method: 'POST' });
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review Azure App Service logs
3. Check device console output
4. Open an issue on GitHub

---

**🎯 Your Espa-TV system is now ready for seamless streaming control!**

A multi-platform system for Veo stream playback and remote control, consisting of:

- **Raspberry Pi Component**: Runs on Raspberry Pi to display Veo streams in Chromium with full screen mode
- **Cloud Service**: Central service for device management and command routing
- **Mobile App**: React Native app for iOS/Android to control devices remotely

## Project Structure

```
espa-tv/
├── raspberry-pi/          # Raspberry Pi component
│   ├── src/
│   │   ├── stream/        # Stream handling logic
│   │   ├── control/       # Local control interface
│   │   └── index.js       # Main application
│   ├── package.json
│   └── config.example.js
├── cloud/                 # Cloud service component
│   ├── src/
│   │   ├── api/           # REST API endpoints
│   │   ├── models/        # Database models
│   │   └── index.js       # Main cloud service
│   ├── package.json
│   └── config.example.js
├── mobile/                # React Native mobile app
│   ├── src/
│   │   ├── screens/       # App screens
│   │   ├── components/    # Reusable components
│   │   ├── services/      # API services
│   │   └── App.js         # Main app component
│   └── package.json
├── shared/                # Shared configuration and types
│   ├── config/
│   └── types/
├── docs/                  # Documentation
│   ├── architecture/
│   └── setup/
└── package.json           # Root package management
```

## Prerequisites

### Raspberry Pi Setup
- Raspberry Pi (recommended: Raspberry Pi 4 or newer)
- Raspbian OS
- Node.js 16+
- Chromium browser

### Cloud Service Setup
- Node.js 16+
- MongoDB (optional, for device persistence)

### Mobile App Setup
- Node.js 16+
- React Native development environment
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

## Quick Start

### 1. Install Dependencies

```bash
# Install all dependencies
npm run install:all

# Or install individually
npm run install:raspberry
npm run install:cloud
npm run install:mobile
```

### 2. Configure Components

#### Raspberry Pi Configuration
```bash
cd raspberry-pi
cp config.example.js config.js
# Edit config.js with your veo stream URL and settings
```

#### Cloud Service Configuration
```bash
cd cloud
cp config.example.js config.js
# Edit config.js with MongoDB URI and other settings
```

#### Mobile App Configuration
The mobile app will automatically connect to `http://localhost:4000` by default.
Update the cloud URL in the app settings if needed.

### 3. Start Components

#### Start Cloud Service First
```bash
npm run start:cloud
```

#### Start Raspberry Pi Component
```bash
npm run start:raspberry
```

#### Start Mobile App Development
```bash
# For Android
npm run android

# For iOS (macOS only)
npm run ios
```

## Raspberry Pi Component

The Raspberry Pi component:
- Launches Chromium in kiosk mode
- Loads and displays Veo streams
- Supports coordinate-based UI interaction (from your existing config)
- Automatically enters fullscreen mode
- Provides local HTTP API for control
- Supports WebSocket connections for real-time control
- Uses JSON configuration files (compatible with your existing setup)

### Local Control API

```
GET  /health           # Health check
POST /control/play     # Play stream
POST /control/pause    # Pause stream
POST /control/fullscreen # Toggle fullscreen
```

### Command Line Usage

```bash
# Start with stream URL from config.json
npm run play

# Start with specific stream URL
npm run play https://your-stream-url.com

# Show help
npm run help

# Show version
npm run version
```

### Authentication & Configuration

The Raspberry Pi component supports secure authentication and flexible configuration:

#### Credentials (credentials.json)
```json
{
  "email": "your-email@domain.com",
  "password": "your-password"
}
```
⚠️ **Important**: This file is automatically excluded from Git and should never be committed.

#### Configuration (config.json)
```json
{
  "veoStreamUrl": "https://your-veo-stream.com",
  "port": 3000,
  "login": {
    "url": "https://live.veo.co/login",
    "enabled": true
  },
  "coordinates": {
    "fullscreen": { "x": 1765, "y": 1045 },
    "playback": { "x": 45, "y": 1052 },
    "click": { "x": 100, "y": 100 }
  },
  "viewport": {
    "width": 1920,
    "height": 1080
  }
}
```

#### Authentication Workflow
1. **Credentials Check**: Looks for `credentials.json` in the raspberry-pi directory
2. **Login Process**: If credentials exist and login is enabled:
   - Navigates to the login URL (default: https://live.veo.co/login)
   - Fills email and password fields
   - Submits the login form
   - Waits for successful authentication
3. **Stream Navigation**: After authentication, navigates to the specified stream URL
4. **Auto-Controls**: Automatically triggers fullscreen and playback using coordinates

#### JavaScript Configuration (config.js)
```javascript
{
  streamUrl: "https://your-veo-stream.com",
  port: 3000,
  chromium: {
    headless: false,
    args: ["--start-fullscreen", "--kiosk"]
  }
}
```

## Cloud Service

The cloud service provides:
- Device registration and management
- Command routing between mobile apps and devices
- Real-time communication via WebSocket
- REST API for device control

### API Endpoints

```
GET  /health           # Service health
GET  /devices          # List connected devices
POST /devices/register # Register new device
POST /control/:deviceId/:command # Send command to device
```

## Mobile App

The React Native mobile app provides:
- Device discovery and listing
- Real-time device control
- Stream playback controls (play/pause/fullscreen)
- Settings for cloud service configuration

### Features
- **Device List**: Discover and connect to available devices
- **Device Control**: Control individual devices with real-time feedback
- **Settings**: Configure cloud service URL and app preferences

## Development

### Running in Development Mode

```bash
# Raspberry Pi (with auto-restart)
npm run dev:raspberry

# Cloud service (with auto-restart)
npm run dev:cloud

# Mobile app (metro bundler)
npm run dev:mobile
```

### Testing

```bash
# Run tests for all components
npm run test:all

# Run tests individually
npm run test:raspberry
npm run test:cloud
npm run test:mobile
```

## Deployment

### Raspberry Pi Deployment

1. Set up auto-start on boot:
   ```bash
   # Create systemd service
   sudo nano /etc/systemd/system/espa-tv.service
   ```

   ```ini
   [Unit]
   Description=Espa-TV Raspberry Pi Service
   After=network.target

   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/espa-tv/raspberry-pi
   ExecStart=/usr/bin/node src/index.js
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

2. Enable and start the service:
   ```bash
   sudo systemctl enable espa-tv
   sudo systemctl start espa-tv
   ```

### Cloud Service Deployment

1. Set up production environment variables
2. Configure reverse proxy (nginx)
3. Set up SSL certificates
4. Configure MongoDB for production

### Mobile App Deployment

1. Build for Android:
   ```bash
   cd mobile
   npx react-native build-android --mode=release
   ```

2. Build for iOS:
   ```bash
   cd mobile
   npx react-native build-ios --mode=release
   ```

## Architecture

The system follows a distributed architecture:

1. **Raspberry Pi devices** run the stream player and expose local control APIs
2. **Cloud service** acts as a central hub for device management and command routing
3. **Mobile apps** connect to the cloud service to discover and control devices
4. **Real-time communication** is handled via WebSocket connections

## Security Considerations

- Configure CORS properly for production
- Use HTTPS/WSS for all communications
- Implement proper authentication for device registration
- Validate all input data
- Use environment variables for sensitive configuration

## Troubleshooting

### Common Issues

1. **Raspberry Pi won't start fullscreen**
   - Check Chromium arguments in config
   - Ensure kiosk mode is enabled

2. **Mobile app can't connect to cloud**
   - Verify cloud service is running
   - Check network connectivity
   - Update cloud URL in app settings

3. **Devices not appearing in mobile app**
   - Ensure Raspberry Pi is connected to cloud service
   - Check device registration process
   - Verify WebSocket connections

### Logs

Check logs for each component:
- Raspberry Pi: Console output or systemd logs
- Cloud: Console output
- Mobile: Metro bundler logs and device logs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details
