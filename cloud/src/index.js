#!/usr/bin/env node

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
require('dotenv').config();

class VeoDongleCloud {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.devices = new Map(); // Store connected devices
    this.port = process.env.PORT || 4000;
    this.mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/veo-dongle';
  }

  async initialize() {
    console.log('Initializing Veo Dongle Cloud Service...');

    // Connect to MongoDB
    await this.connectDatabase();

    // Setup middleware
    this.setupMiddleware();

    // Setup routes
    this.setupRoutes();

    // Setup socket.io for device communication
    this.setupSocketHandlers();

    console.log(`Veo Dongle Cloud Service ready on port ${this.port}`);
  }

  async connectDatabase() {
    try {
      await mongoose.connect(this.mongoUri);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
      // Continue without database for basic functionality
      console.log('Continuing without database connection...');
    }
  }

  setupMiddleware() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        connectedDevices: this.devices.size
      });
    });

    // Get connected devices
    this.app.get('/devices', (req, res) => {
      const deviceList = Array.from(this.devices.values()).map(device => ({
        id: device.id,
        name: device.name,
        status: device.status,
        lastSeen: device.lastSeen
      }));
      res.json(deviceList);
    });

    // Send command to device
    this.app.post('/devices/:deviceId/command', (req, res) => {
      const { deviceId } = req.params;
      const { command, params } = req.body;

      const device = this.devices.get(deviceId);
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      try {
        device.socket.emit('command', { command, params });
        res.json({ success: true, command, deviceId });
      } catch (error) {
        res.status(500).json({ error: 'Failed to send command' });
      }
    });

    // Register device endpoint
    this.app.post('/devices/register', (req, res) => {
      const { deviceId, name, type } = req.body;

      if (!deviceId || !name) {
        return res.status(400).json({ error: 'Device ID and name are required' });
      }

      // This would typically save to database
      res.json({
        success: true,
        deviceId,
        message: 'Device registered successfully'
      });
    });

    // Mobile app control endpoints
    this.app.post('/control/:deviceId/play', (req, res) => {
      this.sendCommandToDevice(req.params.deviceId, 'play', {}, res);
    });

    this.app.post('/control/:deviceId/pause', (req, res) => {
      this.sendCommandToDevice(req.params.deviceId, 'pause', {}, res);
    });

    this.app.post('/control/:deviceId/fullscreen', (req, res) => {
      this.sendCommandToDevice(req.params.deviceId, 'fullscreen', {}, res);
    });
  }

  sendCommandToDevice(deviceId, command, params, res) {
    const device = this.devices.get(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    try {
      device.socket.emit(command, params);
      res.json({ success: true, command, deviceId });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send command' });
    }
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Device connected:', socket.id);

      socket.on('register', (deviceInfo) => {
        const device = {
          id: deviceInfo.id || socket.id,
          name: deviceInfo.name || 'Unknown Device',
          type: deviceInfo.type || 'raspberry-pi',
          socket: socket,
          status: 'connected',
          lastSeen: new Date()
        };

        this.devices.set(device.id, device);
        console.log(`Device registered: ${device.name} (${device.id})`);

        // Send confirmation
        socket.emit('registered', { id: device.id });
      });

      socket.on('status', (status) => {
        const device = Array.from(this.devices.values()).find(d => d.socket === socket);
        if (device) {
          device.status = status;
          device.lastSeen = new Date();
          console.log(`Device ${device.name} status: ${status}`);
        }
      });

      socket.on('disconnect', () => {
        const device = Array.from(this.devices.values()).find(d => d.socket === socket);
        if (device) {
          device.status = 'disconnected';
          console.log(`Device disconnected: ${device.name}`);
        }
      });

      // Handle commands from mobile app via socket
      socket.on('mobile-command', (data) => {
        const { deviceId, command, params } = data;
        const device = this.devices.get(deviceId);

        if (device && device.socket) {
          device.socket.emit(command, params);
          socket.emit('command-sent', { deviceId, command });
        } else {
          socket.emit('command-error', { deviceId, command, error: 'Device not found' });
        }
      });
    });
  }

  async start() {
    try {
      await this.initialize();
      this.server.listen(this.port, () => {
        console.log(`Cloud service listening on port ${this.port}`);
      });
    } catch (error) {
      console.error('Failed to start cloud service:', error);
      process.exit(1);
    }
  }

  async stop() {
    console.log('Stopping Veo Dongle Cloud Service...');

    if (this.server) {
      this.server.close();
    }

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }

    console.log('Cloud service stopped');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  const cloudService = global.cloudServiceInstance;
  if (cloudService) {
    await cloudService.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  const cloudService = global.cloudServiceInstance;
  if (cloudService) {
    await cloudService.stop();
  }
  process.exit(0);
});

// Start the application
if (require.main === module) {
  const cloudService = new VeoDongleCloud();
  global.cloudServiceInstance = cloudService;
  cloudService.start();
}

module.exports = VeoDongleCloud;
