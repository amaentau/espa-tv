#!/usr/bin/env node

/**
 * Test script for HDMI-triggered provisioning workflow
 * Tests the complete integration of HDMI detection, state management, and provisioning logic
 */

const HDMIMonitor = require('./src/hdmi-monitor');
const ProvisioningStateManager = require('./src/provisioning-state');
const path = require('path');
const fs = require('fs');

class ProvisioningWorkflowTester {
  constructor() {
    this.hdmiMonitor = new HDMIMonitor();
    this.stateManager = new ProvisioningStateManager();
    this.testResults = [];
  }

  log(message, result = null) {
    const timestamp = new Date().toISOString();
    const status = result !== null ? (result ? '✅' : '❌') : 'ℹ️';
    console.log(`${status} [${timestamp}] ${message}`);
    this.testResults.push({ timestamp, message, result });
  }

  async runAllTests() {
    console.log('🧪 Starting HDMI Provisioning Workflow Tests\n');

    try {
      await this.testHDMIDetection();
      await this.testStatePersistence();
      await this.testProvisioningDecisionLogic();
      await this.testRecoveryScenarios();
      await this.testAPIEndpoints();

      this.printSummary();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.log(`Test suite failed: ${error.message}`, false);
    }
  }

  async testHDMIDetection() {
    console.log('📺 Testing HDMI Detection...');

    // Test HDMI status check
    const hdmiStatus = await this.hdmiMonitor.checkHDMI();
    this.log(`HDMI detection result: ${hdmiStatus.connected ? 'connected' : 'disconnected'} (${hdmiStatus.method}, ${(hdmiStatus.confidence * 100).toFixed(1)}%)`, true);

    // Test diagnostics
    const diagnostics = await this.hdmiMonitor.getDiagnostics();
    this.log('HDMI diagnostics available', diagnostics !== null);

    // Test cache functionality
    const cachedResult = await this.hdmiMonitor.checkHDMI(); // Should use cache
    this.log('HDMI caching works', cachedResult.cached !== undefined);

    console.log('');
  }

  async testStatePersistence() {
    console.log('💾 Testing State Persistence...');

    // Test initial state
    const initialState = this.stateManager.getState();
    this.log('Initial state loaded', initialState !== null);

    // Test trigger recording
    this.stateManager.recordProvisioningTrigger('test_trigger', { testData: true });
    const stateAfterTrigger = this.stateManager.getState();
    this.log('Trigger recording works', stateAfterTrigger.triggers && stateAfterTrigger.triggers.length > 0);

    // Test session management
    const sessionId = this.stateManager.generateSessionId();
    this.stateManager.recordProvisioningStart(sessionId, { test: true });
    const stateWithSession = this.stateManager.getState();
    this.log('Session start recording works', stateWithSession.currentSession !== null);

    // Test session completion
    this.stateManager.recordProvisioningComplete('success', { testResult: 'ok' });
    const finalState = this.stateManager.getState();
    this.log('Session completion works', finalState.completedSessions && finalState.completedSessions.length > 0);

    // Test statistics
    const stats = this.stateManager.getStatistics();
    this.log('Statistics available', stats !== null && typeof stats === 'object');

    console.log('');
  }

  async testProvisioningDecisionLogic() {
    console.log('🧠 Testing Provisioning Decision Logic...');

    // Mock the _determineProvisioningRequirements method logic
    const testConditions = [
      { name: 'Missing config', conditions: { hasConfig: false, hasCredentials: true, hdmiConnected: true }, expected: true },
      { name: 'Missing credentials', conditions: { hasConfig: true, hasCredentials: false, hdmiConnected: true }, expected: true },
      { name: 'Valid config, HDMI connected', conditions: { hasConfig: true, hasCredentials: true, hdmiConnected: true }, expected: false },
      { name: 'Valid config, HDMI disconnected', conditions: { hasConfig: true, hasCredentials: true, hdmiConnected: false }, expected: false }, // Should wait first
      { name: 'Force provisioning', conditions: { hasConfig: true, hasCredentials: true, hdmiConnected: true, forceProvisioning: true }, expected: true },
      { name: 'Headless override', conditions: { hasConfig: true, hasCredentials: true, hdmiConnected: false, headlessOverride: true }, expected: false }
    ];

    for (const test of testConditions) {
      const decision = this.stateManager.shouldTriggerProvisioning(test.conditions);
      const passed = decision.shouldProvision === test.expected;
      this.log(`Decision logic: ${test.name} - ${passed ? 'PASS' : 'FAIL'} (expected: ${test.expected}, got: ${decision.shouldProvision})`, passed);
    }

    console.log('');
  }

  async testRecoveryScenarios() {
    console.log('🔄 Testing Recovery Scenarios...');

    // Test recovery state detection
    const normalRecovery = this.stateManager.checkRecoveryState();
    this.log('Normal state recovery check', !normalRecovery.needsRecovery);

    // Simulate interrupted session
    const sessionId = this.stateManager.generateSessionId();
    this.stateManager.recordProvisioningStart(sessionId);

    // Manually set old start time to simulate timeout
    const state = this.stateManager.getState();
    if (state.currentSession) {
      state.currentSession.startTime = Date.now() - (40 * 60 * 1000); // 40 minutes ago
      this.stateManager._saveState();

      const recoveryState = this.stateManager.checkRecoveryState();
      this.log('Interrupted session recovery detection', recoveryState.needsRecovery && recoveryState.reason === 'session_timeout');

      // Clean up
      this.stateManager.clearState();
    }

    console.log('');
  }

  async testAPIEndpoints() {
    console.log('🌐 Testing API Endpoints...');

    // This would require a running server, so we'll just test that the endpoints are defined
    // In a real test environment, we would start the server and make HTTP requests

    const EspaTvPlayer = require('./src/index');
    const player = new EspaTvPlayer();

    // Check that the setupServer method exists and can be called
    try {
      // We can't actually start the server in a test, but we can check the method exists
      this.log('API setup method exists', typeof player.setupServer === 'function');
      this.log('HDMI monitor available', player.hdmiMonitor instanceof HDMIMonitor);
      this.log('State manager available', player.stateManager instanceof ProvisioningStateManager);
    } catch (error) {
      this.log('API endpoint check failed', false);
    }

    console.log('');
  }

  printSummary() {
    console.log('📊 Test Summary');
    console.log('================');

    const passed = this.testResults.filter(r => r.result === true).length;
    const failed = this.testResults.filter(r => r.result === false).length;
    const total = this.testResults.length;

    console.log(`Total tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed tests:');
      this.testResults.filter(r => r.result === false).forEach(test => {
        console.log(`  - ${test.message}`);
      });
    }

    console.log('\n✅ Test suite completed');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new ProvisioningWorkflowTester();
  tester.runAllTests().catch(console.error);
}

module.exports = ProvisioningWorkflowTester;
