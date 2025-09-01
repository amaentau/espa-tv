// Shared default configuration for Veo Dongle project

module.exports = {
  // Project information
  project: {
    name: 'Veo Dongle',
    version: '1.0.0',
    description: 'Multi-platform system for Veo stream playback and control'
  },

  // Network configuration
  network: {
    raspberryPi: {
      defaultPort: 3000,
      websocketPort: 3001
    },
    cloud: {
      defaultPort: 4000,
      apiVersion: 'v1'
    },
    mobile: {
      defaultCloudUrl: 'http://localhost:4000'
    }
  },

  // Device configuration
  devices: {
    raspberryPi: {
      chromium: {
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--start-fullscreen',
          '--kiosk',
          '--disable-web-security'
        ],
        defaultViewport: null
      },
      stream: {
        defaultUrl: 'https://example.com/veo-stream',
        timeout: 30000,
        retryAttempts: 3
      }
    }
  },

  // API configuration
  api: {
    timeout: 10000,
    retries: 3,
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100
    }
  },

  // Logging configuration
  logging: {
    level: 'info',
    format: 'json',
    transports: ['console', 'file']
  },

  // Security configuration
  security: {
    jwt: {
      expiresIn: '24h',
      algorithm: 'HS256'
    },
    cors: {
      origins: ['*'], // Configure for production
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  }
};
