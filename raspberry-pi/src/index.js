#!/usr/bin/env node

const puppeteer = require('puppeteer');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

class VeoDongleRaspberryPi {
  constructor() {
    this.browser = null;
    this.page = null;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.streamUrl = process.env.VEO_STREAM_URL || 'https://example.com/veo-stream';
    this.port = process.env.PORT || 3000;
  }

  async initialize() {
    console.log('Initializing Veo Dongle Raspberry Pi...');

    // Setup Express server for local control
    this.setupServer();

    // Launch Chromium browser
    await this.launchBrowser();

    // Navigate to veo stream
    await this.navigateToStream();

    // Setup socket.io for real-time control
    this.setupSocketControl();

    console.log(`Veo Dongle ready. Access control interface at http://localhost:${this.port}`);
  }

  setupServer() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));

    // Basic health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Stream control endpoints
    this.app.post('/control/play', async (req, res) => {
      try {
        await this.playStream();
        res.json({ success: true, action: 'play' });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/control/pause', async (req, res) => {
      try {
        await this.pauseStream();
        res.json({ success: true, action: 'pause' });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    this.app.post('/control/fullscreen', async (req, res) => {
      try {
        await this.enterFullscreen();
        res.json({ success: true, action: 'fullscreen' });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  async launchBrowser() {
    console.log('Launching Chromium browser...');

    this.browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--start-fullscreen',
        '--kiosk',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ],
      defaultViewport: null,
      ignoreDefaultArgs: ['--disable-extensions']
    });

    this.page = await this.browser.newPage();
    console.log('Chromium browser launched successfully');
  }

  async navigateToStream() {
    console.log(`Navigating to veo stream: ${this.streamUrl}`);

    try {
      await this.page.goto(this.streamUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for stream to load
      await this.page.waitForTimeout(2000);

      // Attempt to enter fullscreen automatically
      await this.enterFullscreen();

      console.log('Successfully loaded veo stream');
    } catch (error) {
      console.error('Error loading veo stream:', error);
      throw error;
    }
  }

  async enterFullscreen() {
    try {
      // Try multiple methods to enter fullscreen
      await this.page.evaluate(() => {
        const video = document.querySelector('video');
        if (video) {
          if (video.requestFullscreen) {
            video.requestFullscreen();
          } else if (video.webkitRequestFullscreen) {
            video.webkitRequestFullscreen();
          } else if (video.msRequestFullscreen) {
            video.msRequestFullscreen();
          }
        }

        // Also try document fullscreen
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
          document.documentElement.msRequestFullscreen();
        }
      });

      console.log('Entered fullscreen mode');
    } catch (error) {
      console.error('Error entering fullscreen:', error);
    }
  }

  async playStream() {
    try {
      await this.page.evaluate(() => {
        const video = document.querySelector('video');
        if (video && video.paused) {
          video.play();
        }
      });
      console.log('Stream playback started');
    } catch (error) {
      console.error('Error playing stream:', error);
      throw error;
    }
  }

  async pauseStream() {
    try {
      await this.page.evaluate(() => {
        const video = document.querySelector('video');
        if (video && !video.paused) {
          video.pause();
        }
      });
      console.log('Stream playback paused');
    } catch (error) {
      console.error('Error pausing stream:', error);
      throw error;
    }
  }

  setupSocketControl() {
    this.io.on('connection', (socket) => {
      console.log('Control client connected:', socket.id);

      socket.on('play', async () => {
        try {
          await this.playStream();
          socket.emit('status', { action: 'play', success: true });
        } catch (error) {
          socket.emit('error', { action: 'play', message: error.message });
        }
      });

      socket.on('pause', async () => {
        try {
          await this.pauseStream();
          socket.emit('status', { action: 'pause', success: true });
        } catch (error) {
          socket.emit('error', { action: 'pause', message: error.message });
        }
      });

      socket.on('fullscreen', async () => {
        try {
          await this.enterFullscreen();
          socket.emit('status', { action: 'fullscreen', success: true });
        } catch (error) {
          socket.emit('error', { action: 'fullscreen', message: error.message });
        }
      });

      socket.on('disconnect', () => {
        console.log('Control client disconnected:', socket.id);
      });
    });
  }

  async start() {
    try {
      await this.initialize();
      this.server.listen(this.port, () => {
        console.log(`Server listening on port ${this.port}`);
      });
    } catch (error) {
      console.error('Failed to start Veo Dongle:', error);
      process.exit(1);
    }
  }

  async stop() {
    console.log('Stopping Veo Dongle...');

    if (this.browser) {
      await this.browser.close();
    }

    if (this.server) {
      this.server.close();
    }

    console.log('Veo Dongle stopped');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  const veoDongle = global.veoDongleInstance;
  if (veoDongle) {
    await veoDongle.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  const veoDongle = global.veoDongleInstance;
  if (veoDongle) {
    await veoDongle.stop();
  }
  process.exit(0);
});

// Start the application
if (require.main === module) {
  const veoDongle = new VeoDongleRaspberryPi();
  global.veoDongleInstance = veoDongle;
  veoDongle.start();
}

module.exports = VeoDongleRaspberryPi;
