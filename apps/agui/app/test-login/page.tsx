'use client';

import { useState } from 'react';

export default function TestLoginPage() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const testLogin = async () => {
    setStatus('Testing login...');
    setError('');

    try {
      // Direct API call
      const response = await fetch('http://localhost:8080/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'ciris_admin_password'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      setStatus(`Login successful! Token: ${data.access_token?.substring(0, 20)}...`);

      // Test /v1/auth/me
      const meResponse = await fetch('http://localhost:8080/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${data.access_token}`
        }
      });

      const userData = await meResponse.json();
      setStatus(prev => prev + '\n\nUser data: ' + JSON.stringify(userData, null, 2));

    } catch (err: any) {
      setError(err.message);
      console.error('Login error:', err);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Login Test Page</h1>

      <button
        onClick={testLogin}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Test Login
      </button>

      {status && (
        <pre className="mt-4 p-4 bg-gray-100 rounded">
          {status}
        </pre>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          Error: {error}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-bold mb-2">Manual Login Test</h2>
        <p>Go to: <a href="/login" className="text-blue-500 underline">Login Page</a></p>
        <p>Username: admin</p>
        <p>Password: ciris_admin_password</p>
      </div>
    </div>
  );
}
