'use client';

import { useState, useEffect } from 'react';
import { CIRISClient } from '@/lib/ciris-sdk';
import type { APIKeyInfo } from '@/lib/ciris-sdk/resources/auth';

interface NewKeyDisplay {
  api_key: string;
  description: string;
  expires_at: string;
}

export default function APIKeysPage() {
  const [apiKeys, setApiKeys] = useState<APIKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyDisplay, setNewKeyDisplay] = useState<NewKeyDisplay | null>(null);
  const [description, setDescription] = useState('');
  const [expiresIn, setExpiresIn] = useState(1440); // Default: 1 day
  const [error, setError] = useState<string | null>(null);

  const loadAPIKeys = async () => {
    try {
      setLoading(true);
      const client = new CIRISClient();
      const response = await client.auth.listAPIKeys();
      setApiKeys(response.api_keys);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load API keys:', err);
      setError(err.message || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const handleCreateKey = async () => {
    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const client = new CIRISClient();
      const response = await client.auth.createAPIKey(description.trim(), expiresIn);

      // Show the new key (only time it will be visible)
      setNewKeyDisplay({
        api_key: response.api_key,
        description: response.description,
        expires_at: response.expires_at
      });

      // Reset form
      setDescription('');
      setExpiresIn(1440);
      setShowCreateForm(false);

      // Reload keys list
      await loadAPIKeys();
    } catch (err: any) {
      console.error('Failed to create API key:', err);
      setError(err.message || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const client = new CIRISClient();
      await client.auth.deleteAPIKey(keyId);
      await loadAPIKeys();
      setError(null);
    } catch (err: any) {
      console.error('Failed to delete API key:', err);
      setError(err.message || 'Failed to delete API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const isExpired = (dateStr: string) => {
    return new Date(dateStr) < new Date();
  };

  const expiryOptions = [
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 1440, label: '1 day' },
    { value: 10080, label: '7 days' }
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage API keys for programmatic access to your CIRIS agent
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* New Key Display - Shows full key only once */}
      {newKeyDisplay && (
        <div className="mb-6 p-6 bg-green-50 border-2 border-green-500 rounded-lg">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-green-900 flex items-center gap-2">
                API Key Created Successfully
              </h3>
              <p className="text-sm text-green-700 mt-1">
                This is the only time you will see this key. Copy it now and store it securely.
              </p>
            </div>
            <button
              onClick={() => setNewKeyDisplay(null)}
              className="text-green-700 hover:text-green-900"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-green-900 mb-1">
                Description
              </label>
              <p className="text-sm text-green-800">{newKeyDisplay.description}</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-green-900 mb-1">
                API Key
              </label>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2 bg-white border border-green-300 rounded text-sm font-mono text-gray-900 break-all">
                  {newKeyDisplay.api_key}
                </code>
                <button
                  onClick={() => copyToClipboard(newKeyDisplay.api_key)}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-green-900 mb-1">
                Expires
              </label>
              <p className="text-sm text-green-800">{formatDate(newKeyDisplay.expires_at)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Create New Key Section */}
      <div className="mb-8">
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Create New API Key
          </button>
        ) : (
          <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Create New API Key</h3>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setDescription('');
                  setError(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., CI/CD pipeline, automation script"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expires In
                </label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {expiryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCreateKey}
                  disabled={creating || !description.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                  {creating ? 'Creating...' : 'Create Key'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setDescription('');
                    setError(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* API Keys List */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Your API Keys</h3>
        </div>

        {loading ? (
          <div className="px-6 py-12 text-center text-gray-500">
            Loading API keys...
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            No API keys yet. Create one to get started.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {apiKeys.map((key) => {
              const expired = isExpired(key.expires_at);

              return (
                <div key={key.key_id} className="px-6 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-gray-900">{key.description}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          expired
                            ? 'bg-red-100 text-red-800'
                            : key.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {expired ? 'Expired' : key.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {key.role}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Key ID:</span>
                          <code className="px-2 py-0.5 bg-gray-100 rounded font-mono text-xs">
                            {key.key_id}
                          </code>
                        </div>
                        <div className="flex items-center gap-4">
                          <span>
                            <span className="font-medium">Created:</span> {formatDate(key.created_at)}
                          </span>
                          <span>
                            <span className="font-medium">Expires:</span> {formatDate(key.expires_at)}
                          </span>
                          {key.last_used && (
                            <span>
                              <span className="font-medium">Last used:</span> {formatDate(key.last_used)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteKey(key.key_id)}
                      className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded font-medium"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h4 className="text-sm font-semibold text-yellow-900 mb-2">Security Best Practices</h4>
        <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
          <li>Never share your API keys or commit them to version control</li>
          <li>Use environment variables to store keys in your applications</li>
          <li>Create separate keys for different applications or environments</li>
          <li>Revoke keys immediately if they are compromised</li>
          <li>Use the shortest expiry time that meets your needs</li>
        </ul>
      </div>
    </div>
  );
}
