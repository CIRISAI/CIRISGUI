'use client';

import { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { cirisClient } from '../../lib/ciris-sdk';
import type { OAuthProvider } from '../../lib/ciris-sdk';
import { XMarkIcon, PlusIcon } from '../Icons';

interface OAuthConfigModalProps {
  onClose: () => void;
}

export function OAuthConfigModal({ onClose }: OAuthConfigModalProps) {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [newProvider, setNewProvider] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const response = await cirisClient.auth.listOAuthProviders();
      setProviders(response.providers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OAuth providers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProvider = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);
      await cirisClient.auth.configureOAuthProvider(
        newProvider,
        clientId,
        clientSecret
      );

      // Reset form
      setNewProvider('');
      setClientId('');
      setClientSecret('');
      setShowAddForm(false);

      // Reload providers
      await loadProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure provider');
    } finally {
      setSaving(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'google':
        return '🔵';
      case 'github':
        return '🐙';
      case 'discord':
        return '💬';
      default:
        return '🔑';
    }
  };

  return (
    <Transition.Root show={true} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-2xl max-h-[calc(100vh-2rem)] mx-auto bg-white rounded-lg shadow-xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-5 pb-4 sm:p-6 border-b">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                    OAuth Provider Configuration
                  </Dialog.Title>
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon size="lg" className="text-gray-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 sm:p-6">

                  {error && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <div className="mt-6">
                    {loading ? (
                      <div className="text-center py-12">
                        <div className="inline-flex items-center">
                          <svg className="animate-spin h-5 w-5 mr-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Loading providers...
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Providers List */}
                        <div className="space-y-3">
                          {providers.map((provider) => (
                            <div key={provider.provider} className="bg-gray-50 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center">
                                    <span className="text-2xl mr-3">{getProviderIcon(provider.provider)}</span>
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-900 capitalize">
                                        {provider.provider}
                                      </h4>
                                      <p className="text-xs text-gray-500 mt-1">
                                        Client ID: {provider.client_id}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-3 text-xs">
                                    <p className="text-gray-600">
                                      Callback URL:
                                    </p>
                                    <code className="block mt-1 p-2 bg-gray-100 rounded text-gray-800">
                                      {typeof window !== 'undefined'
                                        ? `${window.location.origin}/oauth/{agent}/callback`
                                        : provider.callback_url}
                                    </code>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Replace {'{agent}'} with: datum, sage, scout, echo-core, or echo-speculative
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}

                          {providers.length === 0 && !showAddForm && (
                            <div className="text-center py-8">
                              <p className="text-gray-500 mb-4">No OAuth providers configured yet</p>
                              <div className="bg-gray-50 rounded-lg p-4 max-w-lg mx-auto">
                                <p className="text-xs text-gray-600 mb-2">Callback URL format:</p>
                                <code className="block text-xs p-2 bg-gray-100 rounded text-gray-800">
                                  {window.location.origin}/oauth/{'{agent}'}/callback
                                </code>
                                <p className="text-xs text-gray-500 mt-2">
                                  Replace {'{agent}'} with: datum, sage, scout, echo-core, or echo-speculative
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Add Provider Form */}
                        {showAddForm ? (
                          <form onSubmit={handleAddProvider} className="mt-6 bg-blue-50 rounded-lg p-4">
                            <h4 className="text-sm font-medium text-gray-900 mb-4">Add OAuth Provider</h4>

                            <div className="space-y-4">
                              <div>
                                <label htmlFor="provider" className="block text-sm font-medium text-gray-700">
                                  Provider
                                </label>
                                <select
                                  id="provider"
                                  value={newProvider}
                                  onChange={(e) => setNewProvider(e.target.value)}
                                  required
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                >
                                  <option value="">Select a provider</option>
                                  <option value="google">Google</option>
                                  <option value="github">GitHub</option>
                                  <option value="discord">Discord</option>
                                </select>
                              </div>

                              <div>
                                <label htmlFor="client-id" className="block text-sm font-medium text-gray-700">
                                  Client ID
                                </label>
                                <input
                                  type="text"
                                  id="client-id"
                                  value={clientId}
                                  onChange={(e) => setClientId(e.target.value)}
                                  required
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  placeholder="Your OAuth app client ID"
                                />
                              </div>

                              <div>
                                <label htmlFor="client-secret" className="block text-sm font-medium text-gray-700">
                                  Client Secret
                                </label>
                                <input
                                  type="password"
                                  id="client-secret"
                                  value={clientSecret}
                                  onChange={(e) => setClientSecret(e.target.value)}
                                  required
                                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  placeholder="Your OAuth app client secret"
                                />
                              </div>

                              <div className="flex justify-end space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowAddForm(false);
                                    setNewProvider('');
                                    setClientId('');
                                    setClientSecret('');
                                  }}
                                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={saving}
                                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                                >
                                  {saving ? 'Saving...' : 'Add Provider'}
                                </button>
                              </div>
                            </div>
                          </form>
                        ) : (
                          <div className="mt-6">
                            <button
                              onClick={() => setShowAddForm(true)}
                              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                            >
                              <PlusIcon size="sm" className="mr-2" />
                              Add Provider
                            </button>
                          </div>
                        )}

                        {/* Instructions */}
                        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
                          <h5 className="text-sm font-medium text-yellow-800 mb-2">Setup Instructions</h5>
                          <ol className="text-xs text-yellow-700 space-y-1 list-decimal list-inside">
                            <li>Create an OAuth app in your provider's developer console</li>
                            <li>Set the redirect URI to the callback URL shown above</li>
                            <li>Copy the client ID and secret from your OAuth app</li>
                            <li>Configure the provider here with those credentials</li>
                            <li>OAuth login buttons will appear on the login page</li>
                          </ol>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
