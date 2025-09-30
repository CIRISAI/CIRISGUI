'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cirisClient } from '../../lib/ciris-sdk';
import { useAuth } from '../../contexts/AuthContext';
import { useAgent } from '../../contexts/AgentContextHybrid';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { StatusDot } from '../../components/Icons';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const { currentAgent } = useAgent();
  const queryClient = useQueryClient();
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [oauthProvider, setOAuthProvider] = useState('');
  const [oauthExternalId, setOAuthExternalId] = useState('');
  const [oauthAccountName, setOAuthAccountName] = useState('');

  // Fetch detailed user info from /me endpoint
  const { data: userInfo, isLoading } = useQuery({
    queryKey: ['user-info'],
    queryFn: () => cirisClient.auth.getMe(),
    enabled: !!currentAgent,
  });

  // Fetch current user details including OAuth links
  const { data: userDetails } = useQuery({
    queryKey: ['user-details', userInfo?.user_id],
    queryFn: () => cirisClient.users.getUser(userInfo!.user_id),
    enabled: !!userInfo?.user_id,
  });

  // Link OAuth account mutation
  const linkOAuthMutation = useMutation({
    mutationFn: async (data: { provider: string; external_id: string; account_name?: string }) => {
      if (!userInfo?.user_id) throw new Error('No user ID');
      return cirisClient.users.linkOAuthAccount(userInfo.user_id, data);
    },
    onSuccess: () => {
      toast.success('OAuth account linked successfully');
      setShowOAuthModal(false);
      setOAuthProvider('');
      setOAuthExternalId('');
      setOAuthAccountName('');
      queryClient.invalidateQueries({ queryKey: ['user-details'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to link OAuth account');
    },
  });

  // Unlink OAuth account mutation
  const unlinkOAuthMutation = useMutation({
    mutationFn: async (data: { provider: string; external_id: string }) => {
      if (!userInfo?.user_id) throw new Error('No user ID');
      return cirisClient.users.unlinkOAuthAccount(userInfo.user_id, data.provider, data.external_id);
    },
    onSuccess: () => {
      toast.success('OAuth account unlinked successfully');
      queryClient.invalidateQueries({ queryKey: ['user-details'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to unlink OAuth account');
    },
  });

  const handleLinkOAuth = () => {
    if (!oauthProvider || !oauthExternalId) {
      toast.error('Provider and External ID are required');
      return;
    }
    linkOAuthMutation.mutate({
      provider: oauthProvider,
      external_id: oauthExternalId,
      account_name: oauthAccountName || undefined,
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account</h1>
          <p className="mt-2 text-lg text-gray-600">
            Manage your account settings, privacy, and linked accounts
          </p>
        </div>

        {/* Account Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            <span className="border-b-2 border-indigo-500 pb-2 px-1 text-sm font-medium text-indigo-600">
              Details
            </span>
            <Link
              href="/account/consent"
              className="border-b-2 border-transparent pb-2 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Consent
            </Link>
            <Link
              href="/account/privacy"
              className="border-b-2 border-transparent pb-2 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Privacy & Data
            </Link>
          </nav>
        </div>

        {/* User Profile Card */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-gray-900">Profile Information</h2>
              <StatusDot
                status={user ? "green" : "red"}
                className="h-3 w-3"
              />
            </div>

            {isLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ) : userInfo ? (
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">User ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">
                    {userInfo.user_id}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Username</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {userInfo.username || 'Not set'}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Role</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      userInfo.role === 'SYSTEM_ADMIN' ? 'bg-red-100 text-red-800' :
                      userInfo.role === 'AUTHORITY' ? 'bg-purple-100 text-purple-800' :
                      userInfo.role === 'ADMIN' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {userInfo.role}
                    </span>
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">API Role</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      userInfo.api_role === 'SYSTEM_ADMIN' ? 'bg-red-100 text-red-800' :
                      userInfo.api_role === 'AUTHORITY' ? 'bg-purple-100 text-purple-800' :
                      userInfo.api_role === 'ADMIN' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {userInfo.api_role}
                    </span>
                  </dd>
                </div>

                {userInfo.wa_role && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">WA Role</dt>
                    <dd className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        userInfo.wa_role === 'root' ? 'bg-red-100 text-red-800' :
                        userInfo.wa_role === 'authority' ? 'bg-purple-100 text-purple-800' :
                        userInfo.wa_role === 'admin' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {userInfo.wa_role}
                      </span>
                    </dd>
                  </div>
                )}

                {userInfo.created_at && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Account Created</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(userInfo.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </dd>
                  </div>
                )}

                {userInfo.last_login && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Login</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(userInfo.last_login).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </dd>
                  </div>
                )}

                {userInfo.permissions && userInfo.permissions.length > 0 && (
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Permissions</dt>
                    <dd className="mt-1">
                      <div className="flex flex-wrap gap-2">
                        {userInfo.permissions.map((permission: string) => (
                          <span
                            key={permission}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                          >
                            {permission}
                          </span>
                        ))}
                      </div>
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500">Unable to load user information</p>
              </div>
            )}
          </div>
        </div>

        {/* Current Agent Info */}
        {currentAgent && (
          <div className="bg-white shadow rounded-lg mb-6">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Current Agent</h2>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Agent Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {currentAgent.agent_name}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Agent ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">
                    {currentAgent.agent_id}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      currentAgent.status === 'running' ? 'bg-green-100 text-green-800' :
                      currentAgent.status === 'stopped' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {currentAgent.status}
                    </span>
                  </dd>
                </div>

                <div>
                  <dt className="text-sm font-medium text-gray-500">Health</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      currentAgent.health === 'healthy' ? 'bg-green-100 text-green-800' :
                      currentAgent.health === 'unhealthy' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {currentAgent.health || 'Unknown'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Linked OAuth Accounts */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Linked OAuth Accounts</h2>
              <button
                onClick={() => setShowOAuthModal(true)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Link Account
              </button>
            </div>

            {userDetails?.linked_oauth_accounts && userDetails.linked_oauth_accounts.length > 0 ? (
              <div className="space-y-3">
                {userDetails.linked_oauth_accounts.map((account, index) => (
                  <div
                    key={`${account.provider}-${account.external_id}`}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            {account.provider.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {account.account_name || account.external_id}
                        </p>
                        <p className="text-sm text-gray-500">
                          {account.provider}
                          {account.is_primary && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Primary
                            </span>
                          )}
                        </p>
                        {account.linked_at && (
                          <p className="text-xs text-gray-400">
                            Linked {new Date(account.linked_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {!account.is_primary && (
                      <button
                        onClick={() => unlinkOAuthMutation.mutate({
                          provider: account.provider,
                          external_id: account.external_id
                        })}
                        disabled={unlinkOAuthMutation.isPending}
                        className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        Unlink
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p>No OAuth accounts linked</p>
                <p className="text-sm mt-1">Link your social accounts to manage authentication</p>
              </div>
            )}
          </div>
        </div>

        {/* OAuth Link Modal */}
        {showOAuthModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Link OAuth Account
              </h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="provider" className="block text-sm font-medium text-gray-700">
                    Provider
                  </label>
                  <select
                    id="provider"
                    value={oauthProvider}
                    onChange={(e) => setOAuthProvider(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="">Select provider...</option>
                    <option value="google">Google</option>
                    <option value="discord">Discord</option>
                    <option value="github">GitHub</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="external-id" className="block text-sm font-medium text-gray-700">
                    External ID
                  </label>
                  <input
                    type="text"
                    id="external-id"
                    value={oauthExternalId}
                    onChange={(e) => setOAuthExternalId(e.target.value)}
                    placeholder="User ID from the provider"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="account-name" className="block text-sm font-medium text-gray-700">
                    Account Name (Optional)
                  </label>
                  <input
                    type="text"
                    id="account-name"
                    value={oauthAccountName}
                    onChange={(e) => setOAuthAccountName(e.target.value)}
                    placeholder="Display name"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowOAuthModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLinkOAuth}
                  disabled={linkOAuthMutation.isPending || !oauthProvider || !oauthExternalId}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {linkOAuthMutation.isPending ? 'Linking...' : 'Link Account'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Actions */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Account Actions</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Sign Out</h3>
                  <p className="text-sm text-gray-500">
                    Sign out of your account and return to the login page
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}