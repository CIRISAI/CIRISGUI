'use client';

import { useState } from 'react';
import { cirisClient } from '../../lib/ciris-sdk';

export default function TestSDKPage() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const testLogin = async () => {
    setLoading(true);
    setStatus('Testing SDK login...');
    setError('');

    try {
      // Test login
      const user = await cirisClient.login('admin', 'ciris_admin_password');
      setStatus(`✓ Login successful! User: ${user.username} (${user.role})\n`);

      // Test agent status
      setStatus(prev => prev + '\n📊 Getting agent status...');
      const agentStatus = await cirisClient.getStatus();
      setStatus(prev => prev + `\n✓ Agent: ${agentStatus.name} - State: ${agentStatus.cognitive_state}`);

      // Test agent identity
      setStatus(prev => prev + '\n\n🤖 Getting agent identity...');
      const identity = await cirisClient.agent.getIdentity();
      setStatus(prev => prev + `\n✓ Purpose: ${identity.purpose}`);
      setStatus(prev => prev + `\n✓ Handlers: ${identity.handlers.length}`);

      // Test system health
      setStatus(prev => prev + '\n\n🏥 Getting system health...');
      const health = await cirisClient.getHealth();
      setStatus(prev => prev + `\n✓ System: ${health.status} - Uptime: ${Math.floor(health.uptime_seconds)}s`);

      // Test adapters
      setStatus(prev => prev + '\n\n🔌 Getting adapters...');
      const adapters = await cirisClient.system.getAdapters();
      setStatus(prev => prev + `\n✓ Adapters: ${adapters.total_count} total, ${adapters.running_count} running`);

      // Test memory stats
      setStatus(prev => prev + '\n\n🧠 Getting memory stats...');
      const memStats = await cirisClient.memory.getStats();
      setStatus(prev => prev + `\n✓ Memory nodes: ${memStats.total_nodes}`);

      setStatus(prev => prev + '\n\n✅ All SDK tests passed!');

    } catch (err: any) {
      setError(err.message || 'Unknown error');
      console.error('SDK test error:', err);
    } finally {
      setLoading(false);
    }
  };

  const testInteract = async () => {
    setLoading(true);
    setError('');

    try {
      setStatus('Sending message to agent...');
      const response = await cirisClient.interact('Hello from the TypeScript SDK!');
      setStatus(`Agent response: ${response.response}\n\nProcessing time: ${response.processing_time_ms}ms`);
    } catch (err: any) {
      setError(err.message || 'Interaction failed');
    } finally {
      setLoading(false);
    }
  };

  const testLogout = async () => {
    try {
      await cirisClient.logout();
      setStatus('Logged out successfully');
    } catch (err: any) {
      setError(err.message || 'Logout failed');
    }
  };

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">CIRIS TypeScript SDK Test</h1>
      <p className="text-gray-600 mb-6">
        Testing the new TypeScript SDK that mirrors the Python SDK with automatic response unwrapping.
      </p>

      <div className="space-x-4 mb-6">
        <button
          onClick={testLogin}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test Full SDK
        </button>

        <button
          onClick={testInteract}
          disabled={loading}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
        >
          Test Interact
        </button>

        <button
          onClick={testLogout}
          disabled={loading}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
        >
          Test Logout
        </button>
      </div>

      {status && (
        <pre className="mt-4 p-4 bg-gray-100 rounded font-mono text-sm whitespace-pre-wrap">
          {status}
        </pre>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="mt-8 p-4 bg-blue-50 rounded">
        <h2 className="font-bold mb-2">SDK Features:</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Automatic response unwrapping (handles data/metadata structure)</li>
          <li>Built-in rate limiting with adaptive backoff</li>
          <li>Automatic token persistence with AuthStore</li>
          <li>Type-safe API with full TypeScript support</li>
          <li>Retry logic with exponential backoff</li>
          <li>Comprehensive error handling</li>
        </ul>
      </div>
    </div>
  );
}
