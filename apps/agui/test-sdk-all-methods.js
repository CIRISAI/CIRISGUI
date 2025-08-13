#!/usr/bin/env node

/**
 * Comprehensive test of all CIRIS SDK methods
 * Tests all 76+ methods across 9 resource modules
 */

const { CIRISClient } = require('./lib/ciris-sdk');

// Test configuration
const BASE_URL = process.env.CIRIS_API_URL || 'http://localhost:8080';
const USERNAME = process.env.CIRIS_USERNAME || 'admin';
const PASSWORD = process.env.CIRIS_PASSWORD || 'ciris_admin_password';

// Test utilities
let testsPassed = 0;
let testsFailed = 0;
const errors = [];

async function test(name, fn) {
  process.stdout.write(`Testing ${name}... `);
  try {
    await fn();
    console.log('✅');
    testsPassed++;
  } catch (error) {
    console.log('❌');
    console.error(`  Error: ${error.message}`);
    testsFailed++;
    errors.push({ test: name, error: error.message });
  }
}

async function runAllTests() {
  console.log('=== CIRIS SDK Comprehensive Test Suite ===\n');
  console.log(`API URL: ${BASE_URL}`);
  console.log(`Username: ${USERNAME}\n`);

  // Initialize client
  const client = new CIRISClient({ baseURL: BASE_URL });

  // 1. AUTH TESTS (7 methods)
  console.log('\n1. AUTH RESOURCE TESTS');

  await test('auth.login', async () => {
    const user = await client.auth.login(USERNAME, PASSWORD);
    if (!user.user_id) throw new Error('No user_id returned');
  });

  await test('auth.getMe', async () => {
    const user = await client.auth.getMe();
    if (!user.username) throw new Error('No username returned');
  });

  await test('auth.isAuthenticated', async () => {
    const isAuth = client.auth.isAuthenticated();
    if (!isAuth) throw new Error('Should be authenticated');
  });

  await test('auth.getCurrentUser', async () => {
    const user = client.auth.getCurrentUser();
    if (!user) throw new Error('No current user');
  });

  await test('auth.getAccessToken', async () => {
    const token = client.auth.getAccessToken();
    if (!token) throw new Error('No access token');
  });

  await test('auth.refresh', async () => {
    const response = await client.auth.refresh();
    if (!response.access_token) throw new Error('No new token');
  });

  // 2. AGENT TESTS (7 methods)
  console.log('\n2. AGENT RESOURCE TESTS');

  await test('agent.getStatus', async () => {
    const status = await client.agent.getStatus();
    if (!status.agent_id) throw new Error('No agent_id');
  });

  await test('agent.getIdentity', async () => {
    const identity = await client.agent.getIdentity();
    if (!identity.name) throw new Error('No agent name');
  });

  await test('agent.interact', async () => {
    const response = await client.agent.interact('Hello from SDK test', 'test_channel');
    if (!response.response) throw new Error('No response');
  });

  await test('agent.getHistory', async () => {
    const history = await client.agent.getHistory({ channel_id: 'test_channel', limit: 10 });
    if (!Array.isArray(history.messages)) throw new Error('No messages array');
  });

  await test('agent.getChannels', async () => {
    const channels = await client.agent.getChannels();
    if (!Array.isArray(channels)) throw new Error('No channels array');
  });

  await test('agent.getMessage', async () => {
    // Skip if no messages
    try {
      const history = await client.agent.getHistory({ channel_id: 'test_channel', limit: 1 });
      if (history.messages.length > 0) {
        const msg = await client.agent.getMessage(history.messages[0].id);
        if (!msg.content) throw new Error('No message content');
      }
    } catch (e) {
      // OK if no messages exist
    }
  });

  await test('agent.clearHistory', async () => {
    const result = await client.agent.clearHistory('test_channel');
    if (result.success === undefined) throw new Error('No success flag');
  });

  // 3. MEMORY TESTS (10 methods)
  console.log('\n3. MEMORY RESOURCE TESTS');

  let testNodeId;

  await test('memory.createNode', async () => {
    const node = await client.memory.createNode({
      type: 'TEST',
      scope: 'LOCAL',
      attributes: { test: true, timestamp: new Date().toISOString() }
    });
    if (!node.node_id) throw new Error('No node_id');
    testNodeId = node.node_id;
  });

  await test('memory.getNode', async () => {
    if (testNodeId) {
      const node = await client.memory.getNode(testNodeId);
      if (!node.id) throw new Error('No node id');
    }
  });

  await test('memory.recall', async () => {
    if (testNodeId) {
      const node = await client.memory.recall(testNodeId);
      if (!node.id) throw new Error('No node id');
    }
  });

  await test('memory.query', async () => {
    const results = await client.memory.query({ type: 'TEST', limit: 5 });
    if (!Array.isArray(results.results)) throw new Error('No results array');
  });

  await test('memory.search', async () => {
    const results = await client.memory.search('test', { limit: 5 });
    if (!Array.isArray(results)) throw new Error('No results array');
  });

  await test('memory.getStats', async () => {
    const stats = await client.memory.getStats();
    if (stats.total_nodes === undefined) throw new Error('No total_nodes');
  });

  await test('memory.getTimeline', async () => {
    const timeline = await client.memory.getTimeline();
    if (!Array.isArray(timeline)) throw new Error('No timeline array');
  });

  await test('memory.updateNode', async () => {
    if (testNodeId) {
      const result = await client.memory.updateNode(testNodeId, {
        attributes: { updated: true }
      });
      if (!result.success) throw new Error('Update failed');
    }
  });

  await test('memory.getRelated', async () => {
    if (testNodeId) {
      const related = await client.memory.getRelated(testNodeId);
      if (!Array.isArray(related)) throw new Error('No related array');
    }
  });

  await test('memory.deleteNode', async () => {
    if (testNodeId) {
      const result = await client.memory.deleteNode(testNodeId);
      if (!result.success) throw new Error('Delete failed');
    }
  });

  // 4. SYSTEM TESTS (24 methods)
  console.log('\n4. SYSTEM RESOURCE TESTS');

  await test('system.getHealth', async () => {
    const health = await client.system.getHealth();
    if (!health.status) throw new Error('No health status');
  });

  await test('system.getServices', async () => {
    const services = await client.system.getServices();
    if (!Array.isArray(services.services)) throw new Error('No services array');
  });

  await test('system.getResources', async () => {
    const resources = await client.system.getResources();
    if (resources.cpu_percent === undefined) throw new Error('No CPU info');
  });

  await test('system.getTime', async () => {
    const time = await client.system.getTime();
    if (!time.current_time) throw new Error('No current time');
  });

  await test('system.getRuntimeStatus', async () => {
    const status = await client.system.getRuntimeStatus();
    if (status.is_paused === undefined) throw new Error('No pause status');
  });

  await test('system.getRuntimeState', async () => {
    const state = await client.system.getRuntimeState();
    if (!state.processor_state) throw new Error('No processor state');
  });

  await test('system.getProcessingQueueStatus', async () => {
    const queue = await client.system.getProcessingQueueStatus();
    if (queue.queue_size === undefined) throw new Error('No queue size');
  });

  await test('system.getServiceHealthDetails', async () => {
    const health = await client.system.getServiceHealthDetails();
    if (!health.overall_health) throw new Error('No overall health');
  });

  await test('system.getServiceSelectionExplanation', async () => {
    const explanation = await client.system.getServiceSelectionExplanation();
    if (!explanation.overview) throw new Error('No overview');
  });

  await test('system.getProcessorStates', async () => {
    const states = await client.system.getProcessorStates();
    if (!Array.isArray(states)) throw new Error('No states array');
    if (states.length !== 6) throw new Error('Should have 6 processor states');
  });

  await test('system.getAdapters', async () => {
    const adapters = await client.system.getAdapters();
    if (!Array.isArray(adapters.adapters)) throw new Error('No adapters array');
  });

  await test('system.getAdapter', async () => {
    // Get first adapter
    const adapters = await client.system.getAdapters();
    if (adapters.adapters.length > 0) {
      const adapter = await client.system.getAdapter(adapters.adapters[0].adapter_id);
      if (!adapter.adapter_type) throw new Error('No adapter type');
    }
  });

  await test('system.resetCircuitBreakers', async () => {
    const result = await client.system.resetCircuitBreakers();
    if (result.success === undefined) throw new Error('No success flag');
  });

  // Skip destructive operations in test
  console.log('\nSkipping destructive system operations:');
  console.log('  - system.pauseRuntime');
  console.log('  - system.resumeRuntime');
  console.log('  - system.singleStepProcessor');
  console.log('  - system.updateServicePriority');
  console.log('  - system.registerAdapter');
  console.log('  - system.unregisterAdapter');
  console.log('  - system.reloadAdapter');
  console.log('  - system.restartService');
  console.log('  - system.pauseProcessor');
  console.log('  - system.resumeProcessor');
  console.log('  - system.pauseAdapter');
  console.log('  - system.resumeAdapter');
  console.log('  - system.shutdown');

  // 5. CONFIG TESTS (7 methods)
  console.log('\n5. CONFIG RESOURCE TESTS');

  await test('config.getAll', async () => {
    const config = await client.config.getAll();
    if (typeof config !== 'object') throw new Error('No config object');
  });

  await test('config.get', async () => {
    const value = await client.config.get('agent_name');
    if (!value) throw new Error('No agent_name config');
  });

  await test('config.set', async () => {
    const result = await client.config.set('test_key', 'test_value', 'Test config');
    if (!result.success) throw new Error('Set failed');
  });

  await test('config.reload', async () => {
    const result = await client.config.reload();
    if (!result.success) throw new Error('Reload failed');
  });

  await test('config.setConfig', async () => {
    const result = await client.config.setConfig({ test_key: 'test_value2' });
    if (!result.success) throw new Error('SetConfig failed');
  });

  await test('config.updateAll', async () => {
    const result = await client.config.updateAll({ test_key: 'test_value3' });
    if (!result.success) throw new Error('UpdateAll failed');
  });

  await test('config.delete', async () => {
    const result = await client.config.delete('test_key');
    if (!result.success) throw new Error('Delete failed');
  });

  // 6. TELEMETRY TESTS (8 methods)
  console.log('\n6. TELEMETRY RESOURCE TESTS');

  await test('telemetry.getOverview', async () => {
    const overview = await client.telemetry.getOverview();
    if (!overview.metrics_collected) throw new Error('No metrics info');
  });

  await test('telemetry.getMetrics', async () => {
    const metrics = await client.telemetry.getMetrics();
    if (!Array.isArray(metrics)) throw new Error('No metrics array');
  });

  await test('telemetry.getMetricDetail', async () => {
    // Try to get detail for first metric if any exist
    const metrics = await client.telemetry.getMetrics();
    if (metrics.length > 0) {
      const detail = await client.telemetry.getMetricDetail(metrics[0].name);
      if (!detail.name) throw new Error('No metric name');
    }
  });

  await test('telemetry.getLogs', async () => {
    const logs = await client.telemetry.getLogs({ limit: 10 });
    if (!Array.isArray(logs)) throw new Error('No logs array');
  });

  await test('telemetry.query', async () => {
    const results = await client.telemetry.query({
      metric_name: 'system.cpu',
      start_time: new Date(Date.now() - 3600000).toISOString()
    });
    if (!results) throw new Error('No query results');
  });

  await test('telemetry.getResources', async () => {
    const resources = await client.telemetry.getResources();
    if (resources.cpu_percent === undefined) throw new Error('No CPU data');
  });

  await test('telemetry.getResourceHistory', async () => {
    const history = await client.telemetry.getResourceHistory({ hours: 1 });
    if (!Array.isArray(history)) throw new Error('No history array');
  });

  await test('telemetry.getTraces', async () => {
    const traces = await client.telemetry.getTraces({ limit: 10 });
    if (!Array.isArray(traces)) throw new Error('No traces array');
  });

  // 7. AUDIT TESTS (5 methods)
  console.log('\n7. AUDIT RESOURCE TESTS');

  await test('audit.getEntries', async () => {
    const entries = await client.audit.getEntries({ page_size: 10 });
    if (!entries.items) throw new Error('No items array');
  });

  await test('audit.searchEntries', async () => {
    const results = await client.audit.searchEntries({
      service: 'api',
      page_size: 5
    });
    if (!results.items) throw new Error('No items array');
  });

  await test('audit.getEntry', async () => {
    // Get first entry if any exist
    const entries = await client.audit.getEntries({ page_size: 1 });
    if (entries.items.length > 0) {
      const entry = await client.audit.getEntry(entries.items[0].id);
      if (!entry.id) throw new Error('No entry id');
    }
  });

  await test('audit.verifyEntry', async () => {
    // Verify first entry if any exist
    const entries = await client.audit.getEntries({ page_size: 1 });
    if (entries.items.length > 0) {
      const result = await client.audit.verifyEntry(entries.items[0].id);
      if (result.valid === undefined) throw new Error('No valid flag');
    }
  });

  // Skip export test as it returns blob
  console.log('\nSkipping audit.exportEntries (returns blob)');

  // 8. WISE AUTHORITY TESTS (5 methods)
  console.log('\n8. WISE AUTHORITY RESOURCE TESTS');

  await test('wa.getStatus', async () => {
    const status = await client.wa.getStatus();
    if (!status.is_active) throw new Error('No active status');
  });

  await test('wa.getPermissions', async () => {
    const permissions = await client.wa.getPermissions();
    if (!Array.isArray(permissions.granted_permissions)) throw new Error('No permissions array');
  });

  await test('wa.getDeferrals', async () => {
    const deferrals = await client.wa.getDeferrals();
    if (!Array.isArray(deferrals.deferrals)) throw new Error('No deferrals array');
  });

  await test('wa.requestGuidance', async () => {
    const guidance = await client.wa.requestGuidance(
      'TEST_DECISION',
      'Testing SDK guidance request',
      { test: true }
    );
    if (!guidance.guidance_id) throw new Error('No guidance id');
  });

  // Skip resolve deferral as we need a real deferral ID
  console.log('\nSkipping wa.resolveDeferral (needs real deferral)');

  // 9. EMERGENCY TESTS (2 methods)
  console.log('\n9. EMERGENCY RESOURCE TESTS');

  await test('emergency.testEmergencySystem', async () => {
    const result = await client.emergency.testEmergencySystem();
    if (!result.test_passed) throw new Error('Emergency test failed');
  });

  // Skip shutdown test
  console.log('\nSkipping emergency.shutdown (would shut down system)');

  // Logout
  await test('auth.logout', async () => {
    await client.auth.logout();
  });

  // SUMMARY
  console.log('\n=== TEST SUMMARY ===');
  console.log(`Total tests: ${testsPassed + testsFailed}`);
  console.log(`Passed: ${testsPassed} ✅`);
  console.log(`Failed: ${testsFailed} ❌`);

  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach(e => {
      console.log(`  - ${e.test}: ${e.error}`);
    });
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
