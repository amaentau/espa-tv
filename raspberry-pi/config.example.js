// Veo Dongle Raspberry Pi Configuration

module.exports = {
  // Veo stream URL to load
  veoStreamUrl: process.env.VEO_STREAM_URL || 'https://example.com/veo-stream',

  // Server port for local control
  port: process.env.PORT || 3000,

  // Optional: Cloud service URL for remote control
  cloudUrl: process.env.CLOUD_URL || 'http://localhost:4000',

  // Optional: Device identifier
  deviceId: process.env.DEVICE_ID || 'raspberry-pi-001',

  // Chromium launch options
  chromium: {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--start-fullscreen',
      '--kiosk'
    ]
  }
};
