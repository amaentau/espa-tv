#!/usr/bin/env node

const { Client, Message } = require('azure-iot-device');
const { Mqtt } = require('azure-iot-device-mqtt');

/**
 * IoT Hub Device Service for Raspberry Pi
 * Handles cloud-to-device commands from BBS/IoT Hub using Direct Methods (primary)
 * and Cloud-to-Device messages (fallback).
 */
class IoTDeviceService {
  constructor(deviceId, hubName = null, sasToken = null, connectionString = null) {
    this.deviceId = deviceId;
    this.hubName = hubName;
    this.sasToken = sasToken;
    this.connectionString = connectionString;
    this.client = null;
    this.isConnected = false;
    this.onCommandCallback = null;
    this.commandHistory = [];
    this.maxHistorySize = 50;

    console.log(`🔗 IoT Device Service initialized for device: ${deviceId}`);
  }

  /**
   * Connect to IoT Hub
   */
  async connect() {
    if (!this.connectionString && (!this.hubName || !this.sasToken)) {
      console.log('⚠️ No IoT Hub connection credentials available - IoT commands disabled');
      return false;
    }

    try {
      console.log('🔗 Connecting to IoT Hub...');

      if (this.connectionString) {
        this.client = Client.fromConnectionString(this.connectionString, Mqtt);
      } else {
        const connectionString = `HostName=${this.hubName}.azure-devices.net;DeviceId=${this.deviceId};SharedAccessSignature=${this.sasToken}`;
        this.client = Client.fromConnectionString(connectionString, Mqtt);
      }

      // Set up event handlers
      this.client.on('connect', () => {
        console.log('✅ Connected to IoT Hub');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('⚠️ Disconnected from IoT Hub');
        this.isConnected = false;
      });

      this.client.on('error', (err) => {
        console.error('❌ IoT Hub client error:', err.message);
        this.isConnected = false;
      });

      // 1. Set up Direct Method handlers (Primary for low latency)
      // We catch all method calls and route them via our handler
      this.client.onDeviceMethod('play', (req, res) => this._onDirectMethod('play', req, res));
      this.client.onDeviceMethod('pause', (req, res) => this._onDirectMethod('pause', req, res));
      this.client.onDeviceMethod('fullscreen', (req, res) => this._onDirectMethod('fullscreen', req, res));
      this.client.onDeviceMethod('restart', (req, res) => this._onDirectMethod('restart', req, res));
      this.client.onDeviceMethod('status', (req, res) => this._onDirectMethod('status', req, res));

      // 2. Set up cloud-to-device message handler (Fallback)
      this.client.on('message', this._handleCloudMessage.bind(this));

      // Connect
      await this.client.open();
      console.log('🎯 IoT Hub device ready (Direct Methods + C2D Fallback)');
      return true;

    } catch (error) {
      console.error('❌ Failed to connect to IoT Hub:', error.message);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Universal Direct Method Handler
   */
  async _onDirectMethod(methodName, request, response) {
    console.log(`⚡ Direct Method received: ${methodName}`);
    this.logDebug(`📦 Payload:`, request.payload);

    this._addToHistory({
      timestamp: new Date().toISOString(),
      command: methodName,
      payload: request.payload,
      source: 'direct-method'
    });

    if (!this.onCommandCallback) {
      console.error('❌ No command callback registered');
      response.send(501, { error: 'No command handler registered on device' }, (err) => {
        if (err) console.error('❌ Failed to send method response:', err.message);
      });
      return;
    }

    try {
      // Execute the command via the registered callback
      const result = await this.onCommandCallback(methodName, request.payload);
      
      // Send immediate response back to IoT Hub
      const status = result.success ? 200 : 400;
      response.send(status, result, (err) => {
        if (err) console.error('❌ Failed to send method response:', err.message);
        else console.log(`✅ Direct Method '${methodName}' response sent (${status})`);
      });
    } catch (error) {
      console.error(`❌ Direct Method '${methodName}' execution failed:`, error.message);
      response.send(500, { success: false, error: error.message }, (err) => {
        if (err) console.error('❌ Failed to send method response:', err.message);
      });
    }
  }

  /**
   * Handle incoming cloud-to-device messages (Fallback)
   */
  async _handleCloudMessage(msg) {
    try {
      const messageData = msg.data.toString('utf8');
      let command;

      try {
        command = JSON.parse(messageData);
      } catch (parseError) {
        command = { command: messageData };
      }

      console.log(`📨 Received C2D command: ${command.command}`, command.payload || '');

      this._addToHistory({
        timestamp: new Date().toISOString(),
        command: command.command,
        payload: command.payload,
        source: 'c2d'
      });

      let result = { success: false, error: 'No command handler registered' };
      if (this.onCommandCallback) {
        try {
          result = await this.onCommandCallback(command.command, command.payload);
        } catch (executeError) {
          result = { success: false, error: executeError.message };
        }
      }

      this.client.complete(msg, (err) => {
        if (err) console.error('❌ Failed to complete message:', err.message);
      });

      console.log(`✅ C2D command processed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    } catch (error) {
      console.error('❌ Error handling C2D message:', error.message);
      if (this.client) this.client.reject(msg);
    }
  }

  logDebug(...args) {
    if (process.env.DEBUG === 'true') console.log('[DEBUG]', ...args);
  }

  onCommand(callback) {
    this.onCommandCallback = callback;
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.close();
        console.log('👋 Disconnected from IoT Hub');
      } catch (error) {
        console.error('❌ Error disconnecting:', error.message);
      }
    }
    this.isConnected = false;
  }

  async sendTelemetry(data) {
    if (!this.isConnected || !this.client) return false;
    try {
      const msg = new Message(JSON.stringify({ deviceId: this.deviceId, timestamp: new Date().toISOString(), ...data }));
      await this.client.sendEvent(msg);
      return true;
    } catch (error) {
      console.error('❌ Telemetry failed:', error.message);
      return false;
    }
  }

  _addToHistory(entry) {
    this.commandHistory.push(entry);
    if (this.commandHistory.length > this.maxHistorySize) this.commandHistory.shift();
  }

  getStatus() {
    return {
      connected: this.isConnected,
      deviceId: this.deviceId,
      lastCommand: this.commandHistory.length > 0 ? this.commandHistory[this.commandHistory.length - 1] : null
    };
  }
}

module.exports = IoTDeviceService;
