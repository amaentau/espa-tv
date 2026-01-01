#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * HDMI Monitor Module
 * Provides robust HDMI connectivity detection with multiple fallback methods
 * Designed for Raspberry Pi and other Linux systems with DRM/KMS support
 */
class HDMIMonitor {
  constructor() {
    this.drmPath = '/sys/class/drm';
    this.tvServicePath = '/sys/class/graphics/fb0';
    this.cacheFile = path.join(__dirname, '..', '.hdmi-cache');
    this.cacheExpiryMs = 30000; // 30 seconds cache
    this.lastCheck = null;
    this.cachedResult = null;
  }

  /**
   * Main HDMI detection with caching and multiple methods
   * @param {boolean} useCache - Whether to use cached results
   * @returns {Promise<{connected: boolean, method: string, confidence: number}>}
   */
  async checkHDMI(useCache = true) {
    const now = Date.now();

    // Return cached result if recent and cache is enabled
    if (useCache && this.lastCheck && (now - this.lastCheck) < this.cacheExpiryMs && this.cachedResult) {
      this.cachedResult.cached = true;
      return this.cachedResult;
    }

    const result = await this._performHDMICheck();
    this.lastCheck = now;
    this.cachedResult = { ...result, cached: false };

    // Cache result to file for persistence across restarts
    this._saveCacheResult(result);

    return result;
  }

  /**
   * Perform actual HDMI check using multiple detection methods
   * @returns {Promise<{connected: boolean, method: string, confidence: number}>}
   */
  async _performHDMICheck() {
    const methods = [
      { name: 'drm_hdmi_status', fn: this._checkDRMHDMIPorts.bind(this), weight: 1.0 },
      { name: 'drm_connector_status', fn: this._checkDRMConnectors.bind(this), weight: 0.9 },
      { name: 'fb_device_mode', fn: this._checkFramebufferMode.bind(this), weight: 0.7 },
      { name: 'cec_presence', fn: this._checkCECPresence.bind(this), weight: 0.5 },
      { name: 'vcgencmd_display', fn: this._checkVcgencmdDisplay.bind(this), weight: 0.6 }
    ];

    const results = [];

    for (const method of methods) {
      try {
        const result = await method.fn();
        if (result !== null) {
          results.push({
            method: method.name,
            connected: result,
            weight: method.weight,
            confidence: method.weight * (result ? 1.0 : 0.8) // Slightly less confident for negative results
          });
        }
      } catch (error) {
        // Method failed, continue to next method
        console.debug(`HDMI check method ${method.name} failed:`, error.message);
      }
    }

    // If no methods worked, try cache as fallback
    if (results.length === 0) {
      const cached = this._loadCacheResult();
      if (cached) {
        return {
          connected: cached.connected,
          method: 'cache_fallback',
          confidence: 0.3,
          cached: true
        };
      }
      // Ultimate fallback: assume connected (safer for provisioning logic)
      return {
        connected: true,
        method: 'fallback_assume_connected',
        confidence: 0.1
      };
    }

    // Weighted voting system
    const connectedVotes = results.filter(r => r.connected).reduce((sum, r) => sum + r.weight, 0);
    const disconnectedVotes = results.filter(r => !r.connected).reduce((sum, r) => sum + r.weight, 0);
    const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);

    const connected = connectedVotes > disconnectedVotes;
    const confidence = Math.max(connectedVotes, disconnectedVotes) / totalWeight;

    // Find the primary method that contributed to the decision
    const primaryMethod = results.find(r => r.connected === connected);

    return {
      connected,
      method: primaryMethod ? primaryMethod.method : 'weighted_vote',
      confidence: Math.min(confidence, 1.0)
    };
  }

  /**
   * Check HDMI ports via DRM subsystem (most reliable method)
   * @returns {boolean|null} true=connected, false=disconnected, null=unknown
   */
  async _checkDRMHDMIPorts() {
    try {
      if (!fs.existsSync(this.drmPath)) {
        return null;
      }

      const entries = fs.readdirSync(this.drmPath);
      const hdmiPorts = entries.filter(entry => entry.includes('HDMI'));

      for (const port of hdmiPorts) {
        const statusPath = path.join(this.drmPath, port, 'status');
        if (fs.existsSync(statusPath)) {
          const status = fs.readFileSync(statusPath, 'utf8').trim();
          if (status === 'connected') {
            return true;
          }
        }
      }

      // If we found HDMI ports but none are connected, assume disconnected
      return hdmiPorts.length > 0 ? false : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check DRM connectors for display information
   * @returns {boolean|null} true=connected, false=disconnected, null=unknown
   */
  async _checkDRMConnectors() {
    try {
      if (!fs.existsSync(this.drmPath)) {
        return null;
      }

      const entries = fs.readdirSync(this.drmPath);
      const connectors = entries.filter(entry => entry.startsWith('card') && entry.includes('-'));

      for (const connector of connectors) {
        const statusPath = path.join(this.drmPath, connector, 'status');
        if (fs.existsSync(statusPath)) {
          const status = fs.readFileSync(statusPath, 'utf8').trim();
          if (status === 'connected') {
            return true;
          }
        }
      }

      return false; // Found connectors but none connected
    } catch (error) {
      return null;
    }
  }

  /**
   * Check framebuffer device mode (legacy method)
   * @returns {boolean|null} true=connected, false=disconnected, null=unknown
   */
  async _checkFramebufferMode() {
    try {
      const modePath = path.join(this.tvServicePath, 'mode');
      if (fs.existsSync(modePath)) {
        const mode = fs.readFileSync(modePath, 'utf8').trim();
        // If mode is set to something other than default, likely connected
        return mode && mode !== '0' && mode !== 'DMT';
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check for CEC device presence (HDMI-CEC indicates physical connection)
   * @returns {boolean|null} true=connected, false=disconnected, null=unknown
   */
  async _checkCECPresence() {
    try {
      const cecPath = '/dev/cec0';
      const cecInfo = fs.existsSync(cecPath) && fs.statSync(cecPath);
      return cecInfo ? true : false;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check using vcgencmd (Raspberry Pi specific)
   * @returns {boolean|null} true=connected, false=disconnected, null=unknown
   */
  async _checkVcgencmdDisplay() {
    try {
      const { exec } = require('child_process');
      const util = require('util');
      const execAsync = util.promisify(exec);

      const { stdout } = await execAsync('vcgencmd display_power 2>/dev/null || echo "error"');
      if (stdout.includes('display_power=1')) {
        return true;
      } else if (stdout.includes('display_power=0')) {
        return false;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Wait for HDMI connection with timeout
   * @param {number} timeoutMs - Timeout in milliseconds
   * @param {number} checkIntervalMs - Check interval in milliseconds
   * @returns {Promise<{connected: boolean, method: string, confidence: number, waitedMs: number}>}
   */
  async waitForHDMI(timeoutMs = 10000, checkIntervalMs = 1000) {
    const startTime = Date.now();

    console.log(`🖥️ Waiting for HDMI connection (timeout: ${timeoutMs}ms)...`);

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.checkHDMI(false); // Don't use cache for waiting

      if (result.connected && result.confidence > 0.5) {
        const waitedMs = Date.now() - startTime;
        console.log(`✅ HDMI connected after ${waitedMs}ms (method: ${result.method}, confidence: ${(result.confidence * 100).toFixed(1)}%)`);
        return { ...result, waitedMs };
      }

      await this.sleep(checkIntervalMs);
    }

    const waitedMs = Date.now() - startTime;
    const finalResult = await this.checkHDMI(false);
    console.log(`⏰ HDMI wait timeout after ${waitedMs}ms (final state: ${finalResult.connected ? 'connected' : 'disconnected'})`);
    return { ...finalResult, waitedMs, timeout: true };
  }

  /**
   * Save HDMI check result to cache file
   * @param {object} result - HDMI check result
   */
  _saveCacheResult(result) {
    try {
      const cacheData = {
        timestamp: Date.now(),
        result: result
      };
      fs.writeFileSync(this.cacheFile, JSON.stringify(cacheData), 'utf8');
    } catch (error) {
      // Non-critical, ignore
    }
  }

  /**
   * Load HDMI check result from cache file
   * @returns {object|null} Cached result or null
   */
  _loadCacheResult() {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        return null;
      }

      const cacheData = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
      const age = Date.now() - cacheData.timestamp;

      if (age < this.cacheExpiryMs) {
        return { ...cacheData.result, cached: true, age };
      }
    } catch (error) {
      // Invalid cache, ignore
    }
    return null;
  }

  /**
   * Check if headless mode is enabled (overrides HDMI detection)
   * @returns {boolean}
   */
  isHeadlessOverrideEnabled() {
    const headlessFile = path.join(__dirname, '..', '.headless_ok');
    return fs.existsSync(headlessFile);
  }

  /**
   * Enable headless override (for development/testing)
   */
  enableHeadlessOverride() {
    const headlessFile = path.join(__dirname, '..', '.headless_ok');
    try {
      fs.writeFileSync(headlessFile, 'Enabled by HDMI monitor\n', 'utf8');
      console.log('📱 Headless override enabled (.headless_ok created)');
    } catch (error) {
      console.warn('⚠️ Failed to enable headless override:', error.message);
    }
  }

  /**
   * Disable headless override
   */
  disableHeadlessOverride() {
    const headlessFile = path.join(__dirname, '..', '.headless_ok');
    try {
      if (fs.existsSync(headlessFile)) {
        fs.unlinkSync(headlessFile);
        console.log('🖥️ Headless override disabled (.headless_ok removed)');
      }
    } catch (error) {
      console.warn('⚠️ Failed to disable headless override:', error.message);
    }
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get diagnostic information
   * @returns {object} Diagnostic data
   */
  async getDiagnostics() {
    const hdmiStatus = await this.checkHDMI(false);
    const cached = this._loadCacheResult();

    return {
      hdmiStatus,
      cachedResult: cached,
      headlessOverride: this.isHeadlessOverrideEnabled(),
      drmPathExists: fs.existsSync(this.drmPath),
      cacheFileExists: fs.existsSync(this.cacheFile),
      availableMethods: [
        { name: 'drm_hdmi_status', available: true },
        { name: 'drm_connector_status', available: true },
        { name: 'fb_device_mode', available: fs.existsSync(path.join(this.tvServicePath, 'mode')) },
        { name: 'cec_presence', available: fs.existsSync('/dev/cec0') },
        { name: 'vcgencmd_display', available: true } // Assume available on RPi
      ]
    };
  }
}

module.exports = HDMIMonitor;
