#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Provisioning State Manager
 * Manages persistent state for provisioning triggers and ensures deterministic behavior
 * across power cycles and interrupted provisioning sessions.
 */
class ProvisioningStateManager {
  constructor() {
    this.stateFile = path.join(__dirname, '..', '.provisioning-state');
    this.state = this._loadState();
    this.maxStateHistory = 10; // Keep last 10 state transitions
    this.stateLockFile = `${this.stateFile}.lock`;
  }

  /**
   * Get current provisioning state
   * @returns {object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Check if provisioning should be triggered based on current conditions
   * @param {object} conditions - Current system conditions
   * @returns {object} Decision result
   */
  shouldTriggerProvisioning(conditions = {}) {
    const {
      hasConfig = this._hasValidConfig(),
      hasCredentials = this._hasValidCredentials(),
      hdmiConnected = null,
      forceProvisioning = process.env.FORCE_PROVISIONING === 'true',
      headlessOverride = this._hasHeadlessOverride()
    } = conditions;

    // Force provisioning takes precedence
    if (forceProvisioning) {
      return {
        shouldProvision: true,
        reason: 'force_provisioning_env',
        confidence: 1.0
      };
    }

    // Headless override allows normal operation without HDMI
    if (headlessOverride) {
      return {
        shouldProvision: false,
        reason: 'headless_override',
        confidence: 1.0
      };
    }

    // If we have valid config and credentials, normal operation
    if (hasConfig && hasCredentials) {
      return {
        shouldProvision: false,
        reason: 'valid_config_and_credentials',
        confidence: 1.0
      };
    }

    // Missing core configuration always triggers provisioning
    if (!hasConfig) {
      return {
        shouldProvision: true,
        reason: 'missing_config',
        confidence: 1.0
      };
    }

    // Missing credentials always triggers provisioning
    if (!hasCredentials) {
      return {
        shouldProvision: true,
        reason: 'missing_credentials',
        confidence: 1.0
      };
    }

    // HDMI-based provisioning logic
    if (hdmiConnected === false) {
      // No HDMI and no valid config = definite provisioning
      if (!hasConfig) {
        return {
          shouldProvision: true,
          reason: 'no_hdmi_no_config',
          confidence: 1.0
        };
      }

      // No HDMI but have config = check state history
      const recentTriggers = this._getRecentTriggers('hdmi_disconnect', 5 * 60 * 1000); // Last 5 minutes
      if (recentTriggers.length === 0) {
        // First time seeing no HDMI, mark for potential provisioning
        this._recordTrigger('hdmi_disconnect', { hdmiConnected: false });
        return {
          shouldProvision: false,
          reason: 'hdmi_disconnect_first_time',
          confidence: 0.7,
          waitForRetry: true
        };
      } else {
        // HDMI has been disconnected for a while, trigger provisioning
        return {
          shouldProvision: true,
          reason: 'hdmi_disconnected_timeout',
          confidence: 0.9
        };
      }
    }

    // HDMI connected or unknown = normal operation
    return {
      shouldProvision: false,
      reason: 'hdmi_connected_or_unknown',
      confidence: 0.8
    };
  }

  /**
   * Record a provisioning trigger event
   * @param {string} triggerType - Type of trigger
   * @param {object} metadata - Additional data
   */
  recordProvisioningTrigger(triggerType, metadata = {}) {
    const trigger = {
      id: this._generateId(),
      type: triggerType,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid
      }
    };

    this.state.triggers = this.state.triggers || [];
    this.state.triggers.unshift(trigger);

    // Keep only recent triggers
    this.state.triggers = this.state.triggers.slice(0, this.maxStateHistory);

    // Update state metadata
    this.state.lastTrigger = trigger;
    this.state.triggerCount = (this.state.triggerCount || 0) + 1;

    this._saveState();
  }

  /**
   * Record provisioning session start
   * @param {string} sessionId - Unique session identifier
   * @param {object} metadata - Session metadata
   */
  recordProvisioningStart(sessionId, metadata = {}) {
    const session = {
      id: sessionId,
      startTime: Date.now(),
      status: 'active',
      metadata: {
        ...metadata,
        pid: process.pid,
        nodeVersion: process.version
      }
    };

    this.state.currentSession = session;
    this.state.lastProvisioningStart = Date.now();
    this._saveState();
  }

  /**
   * Record provisioning session completion
   * @param {string} result - 'success' or 'failure'
   * @param {object} metadata - Completion metadata
   */
  recordProvisioningComplete(result, metadata = {}) {
    if (!this.state.currentSession) {
      console.warn('No active provisioning session to complete');
      return;
    }

    const session = this.state.currentSession;
    session.endTime = Date.now();
    session.duration = session.endTime - session.startTime;
    session.result = result;
    session.status = 'completed';
    session.completionMetadata = metadata;

    // Move to completed sessions
    this.state.completedSessions = this.state.completedSessions || [];
    this.state.completedSessions.unshift(session);

    // Keep only recent completed sessions
    this.state.completedSessions = this.state.completedSessions.slice(0, 5);

    // Clear current session
    delete this.state.currentSession;

    // Update statistics
    this.state.totalProvisioningSessions = (this.state.totalProvisioningSessions || 0) + 1;
    this.state.successfulProvisioningSessions = (this.state.successfulProvisioningSessions || 0) + (result === 'success' ? 1 : 0);

    this._saveState();
  }

  /**
   * Check if we're in a provisioning recovery state
   * @returns {object} Recovery state info
   */
  checkRecoveryState() {
    const currentSession = this.state.currentSession;
    if (!currentSession) {
      return { needsRecovery: false };
    }

    const sessionAge = Date.now() - currentSession.startTime;
    const maxSessionAge = 30 * 60 * 1000; // 30 minutes

    if (sessionAge > maxSessionAge) {
      return {
        needsRecovery: true,
        reason: 'session_timeout',
        sessionAge,
        maxSessionAge
      };
    }

    // Check if this is a restart after power interruption
    const lastCompleted = this.state.completedSessions && this.state.completedSessions[0];
    if (lastCompleted && lastCompleted.endTime) {
      const timeSinceCompletion = Date.now() - lastCompleted.endTime;
      if (timeSinceCompletion < 60 * 1000) { // Less than 1 minute ago
        return {
          needsRecovery: true,
          reason: 'recent_power_cycle',
          timeSinceCompletion
        };
      }
    }

    return { needsRecovery: false };
  }

  /**
   * Generate a unique session ID
   * @returns {string} Session ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `prov-${timestamp}-${random}`;
  }

  /**
   * Get provisioning statistics
   * @returns {object} Statistics
   */
  getStatistics() {
    return {
      totalTriggers: this.state.triggerCount || 0,
      totalSessions: this.state.totalProvisioningSessions || 0,
      successfulSessions: this.state.successfulProvisioningSessions || 0,
      currentSession: this.state.currentSession || null,
      lastTrigger: this.state.lastTrigger || null,
      lastProvisioningStart: this.state.lastProvisioningStart || null,
      completedSessionsCount: this.state.completedSessions ? this.state.completedSessions.length : 0
    };
  }

  /**
   * Clear all state (for testing or reset)
   */
  clearState() {
    this.state = this._createDefaultState();
    this._saveState();
  }

  /**
   * Get recent triggers of a specific type
   * @param {string} type - Trigger type
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {array} Recent triggers
   */
  _getRecentTriggers(type, timeWindowMs = 5 * 60 * 1000) {
    const now = Date.now();
    const triggers = this.state.triggers || [];
    return triggers.filter(trigger =>
      trigger.type === type &&
      (now - trigger.timestamp) < timeWindowMs
    );
  }

  /**
   * Check if valid config exists
   * @returns {boolean}
   */
  _hasValidConfig() {
    const configPath = path.join(__dirname, '..', 'config.json');
    try {
      if (!fs.existsSync(configPath)) return false;
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return !!(config && config.azure && config.azure.bbsUrl);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if valid credentials exist
   * @returns {boolean}
   */
  _hasValidCredentials() {
    const credPath = path.join(__dirname, '..', 'credentials.json');
    try {
      if (!fs.existsSync(credPath)) return false;
      const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      return !!(creds && creds.email && creds.password);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if headless override is enabled
   * @returns {boolean}
   */
  _hasHeadlessOverride() {
    const headlessPath = path.join(__dirname, '..', '.headless_ok');
    return fs.existsSync(headlessPath);
  }

  /**
   * Generate unique ID
   * @returns {string}
   */
  _generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Load state from file with locking
   * @returns {object} State object
   */
  _loadState() {
    if (!fs.existsSync(this.stateFile)) {
      return this._createDefaultState();
    }

    // Check for lock file (another process might be writing)
    if (fs.existsSync(this.stateLockFile)) {
      const lockAge = Date.now() - fs.statSync(this.stateLockFile).mtime.getTime();
      if (lockAge < 5000) { // Lock is less than 5 seconds old
        console.warn('State file is locked, using default state');
        return this._createDefaultState();
      } else {
        // Stale lock, remove it
        try {
          fs.unlinkSync(this.stateLockFile);
        } catch (e) {
          // Ignore
        }
      }
    }

    try {
      const data = fs.readFileSync(this.stateFile, 'utf8');
      const loadedState = JSON.parse(data);

      // Validate state structure
      if (!loadedState || typeof loadedState !== 'object') {
        console.warn('Invalid state file, using defaults');
        return this._createDefaultState();
      }

      return { ...this._createDefaultState(), ...loadedState };
    } catch (error) {
      console.warn('Failed to load state file:', error.message);
      return this._createDefaultState();
    }
  }

  /**
   * Save state to file with locking
   */
  _saveState() {
    try {
      // Create lock file
      fs.writeFileSync(this.stateLockFile, Date.now().toString(), 'utf8');

      // Write state
      const data = JSON.stringify(this.state, null, 2);
      fs.writeFileSync(this.stateFile, data, 'utf8');

      // Remove lock file
      fs.unlinkSync(this.stateLockFile);
    } catch (error) {
      console.error('Failed to save state:', error.message);
      // Try to remove lock file even on error
      try {
        if (fs.existsSync(this.stateLockFile)) {
          fs.unlinkSync(this.stateLockFile);
        }
      } catch (e) {
        // Ignore
      }
    }
  }

  /**
   * Create default state object
   * @returns {object} Default state
   */
  _createDefaultState() {
    return {
      version: '1.0',
      created: Date.now(),
      triggers: [],
      completedSessions: [],
      triggerCount: 0,
      totalProvisioningSessions: 0,
      successfulProvisioningSessions: 0
    };
  }
}

module.exports = ProvisioningStateManager;
