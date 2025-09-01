// Veo Dongle Cloud Configuration

module.exports = {
  // Server port
  port: process.env.PORT || 4000,

  // MongoDB connection string
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/veo-dongle',

  // JWT secret for authentication
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key',

  // CORS origins (add your mobile app URLs)
  corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],

  // Device connection timeout (in milliseconds)
  deviceTimeout: process.env.DEVICE_TIMEOUT || 30000,

  // API rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  }
};
