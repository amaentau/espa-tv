import io from 'socket.io-client';
import axios from 'axios';

class DeviceService {
  constructor() {
    this.socket = null;
    this.baseUrl = 'http://localhost:4000'; // Change this to your cloud service URL
    this.deviceStatusCallbacks = new Map();
  }

  async connect() {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(this.baseUrl, {
      transports: ['websocket', 'polling'],
    });

    return new Promise((resolve, reject) => {
      this.socket.on('connect', () => {
        console.log('Connected to cloud service');
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        reject(error);
      });

      // Handle device status updates
      this.socket.on('device-status', (data) => {
        const { deviceId, status } = data;
        const callback = this.deviceStatusCallbacks.get(deviceId);
        if (callback) {
          callback(status);
        }
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  async getDevices() {
    try {
      const response = await axios.get(`${this.baseUrl}/devices`);
      return response.data;
    } catch (error) {
      console.error('Error fetching devices:', error);
      throw error;
    }
  }

  async sendCommand(deviceId, command, params = {}) {
    try {
      // Send via HTTP API
      const response = await axios.post(`${this.baseUrl}/control/${deviceId}/${command}`, params);

      // Also send via socket for real-time updates
      if (this.socket) {
        this.socket.emit('mobile-command', {
          deviceId,
          command,
          params,
        });
      }

      return response.data;
    } catch (error) {
      console.error(`Error sending ${command} command:`, error);
      throw error;
    }
  }

  subscribeToDeviceStatus(deviceId, callback) {
    this.deviceStatusCallbacks.set(deviceId, callback);

    // Return unsubscribe function
    return () => {
      this.deviceStatusCallbacks.delete(deviceId);
    };
  }

  async registerDevice(deviceInfo) {
    try {
      const response = await axios.post(`${this.baseUrl}/devices/register`, deviceInfo);
      return response.data;
    } catch (error) {
      console.error('Error registering device:', error);
      throw error;
    }
  }

  // Utility method to check cloud service health
  async checkHealth() {
    try {
      const response = await axios.get(`${this.baseUrl}/health`);
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }
}

// Create singleton instance
const deviceService = new DeviceService();

export default deviceService;
