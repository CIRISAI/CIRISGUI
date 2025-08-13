'use client';

import { useState } from 'react';
import { cirisClient } from '../../lib/ciris-sdk';
import { useAuth } from '../../contexts/AuthContext';

export default function TestAuthPage() {
  const { user } = useAuth();
  const [results, setResults] = useState<any[]>([]);

  const addResult = (test: string, result: any) => {
    setResults(prev => [...prev, { test, result, timestamp: new Date().toISOString() }]);
  };

  const runTests = async () => {
    setResults([]);

    // Test 1: Check auth status
    addResult('Auth Status', {
      isAuthenticated: cirisClient.isAuthenticated(),
      user: user,
      tokenInLocalStorage: !!localStorage.getItem('ciris_auth_token'),
      tokenInCookie: document.cookie.includes('auth_token')
    });

    // Test 2: Try to fetch memory
    try {
      const memoryResult = await cirisClient.memory.query('test', { limit: 1 });
      addResult('Memory Query', { success: true, data: memoryResult });
    } catch (error: any) {
      addResult('Memory Query', { success: false, error: error.message });
    }

    // Test 3: Try to fetch config
    try {
      const configResult = await cirisClient.config.getAll();
      addResult('Config Fetch', { success: true, data: configResult });
    } catch (error: any) {
      addResult('Config Fetch', { success: false, error: error.message });
    }

    // Test 4: Try to fetch system health
    try {
      const healthResult = await cirisClient.system.getHealth();
      addResult('System Health', { success: true, data: healthResult });
    } catch (error: any) {
      addResult('System Health', { success: false, error: error.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h1 className="text-2xl font-bold text-gray-900">Auth Debug Page</h1>
          <button
            onClick={runTests}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Run Tests
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Test Results</h2>
            <div className="space-y-4">
              {results.map((result, idx) => (
                <div key={idx} className="border-t pt-4">
                  <h3 className="font-medium text-gray-900">{result.test}</h3>
                  <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">
                    {JSON.stringify(result.result, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
