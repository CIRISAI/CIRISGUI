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

  // Fetch detailed user info from /me endpoint
  const { data: userInfo, isLoading } = useQuery({
    queryKey: ['user-info'],
    queryFn: () => cirisClient.auth.getMe(),
    enabled: !!currentAgent,
  });

  // Fetch current user details including OAuth links
  const { data: userDetails } = useQuery({
    queryKey: ['user-details', userInfo?.user_id],
    queryFn: () => cirisClient.users.get(userInfo!.user_id),
    enabled: !!userInfo?.user_id,
  });

  // Available OAuth providers with better icons and info
  const availableProviders = [
    {
      id: 'google',
      name: 'Google',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
      color: 'bg-white border-gray-300 hover:bg-gray-50'
    },
    {
      id: 'discord',
      name: 'Discord',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#5865F2">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      ),
      color: 'bg-indigo-600 hover:bg-indigo-700 text-white'
    }
  ];

  // Check which providers are already linked
  const getLinkedProviders = () => {
    return userDetails?.linked_oauth_accounts?.map(account => account.provider) || [];
  };

  // Handle OAuth linking flow
  const handleOAuthLink = async (provider: string) => {
    try {
      // Store intention to link (not login) and provider info
      localStorage.setItem('oauthIntention', 'link');
      localStorage.setItem('oauthProvider', provider);
      localStorage.setItem('oauthReturnUrl', '/account');

      // Determine OAuth URLs based on deployment mode (similar to login flow)
      let oauthUrl;
      let redirectUri;

      if (currentAgent) {
        // Use agent-specific callback URL for linking
        redirectUri = encodeURIComponent(`${window.location.origin}/oauth/${currentAgent.agent_id}/${provider}/callback`);

        // Check if we're in managed mode or standalone
        if (window.location.hostname.includes('agents.ciris.ai') || currentAgent.api_endpoint?.includes('/api/')) {
          // Managed mode
          oauthUrl = `${window.location.origin}/api/${currentAgent.agent_id}/v1/auth/oauth/${provider}/login`;
        } else {
          // Standalone mode
          const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || window.location.origin;
          oauthUrl = `${apiBaseUrl}/v1/auth/oauth/${provider}/login`;
        }

        // Redirect to OAuth provider
        window.location.href = `${oauthUrl}?redirect_uri=${redirectUri}`;
      } else {
        toast.error('No agent selected');
      }
    } catch (error) {
      console.error('OAuth link error:', error);
      toast.error('Failed to initiate OAuth linking');
    }
  };

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
            <h2 className="text-lg font-medium text-gray-900 mb-6">Connected Accounts</h2>

            {/* Available providers to link */}
            <div className="space-y-4 mb-6">
              {availableProviders.map((provider) => {
                const isLinked = getLinkedProviders().includes(provider.id);
                const linkedAccount = userDetails?.linked_oauth_accounts?.find(acc => acc.provider === provider.id);

                return (
                  <div key={provider.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {provider.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{provider.name}</p>
                        {isLinked && linkedAccount ? (
                          <div>
                            <p className="text-sm text-gray-500">
                              Connected as {linkedAccount.account_name || linkedAccount.external_id}
                            </p>
                            {linkedAccount.linked_at && (
                              <p className="text-xs text-gray-400">
                                Linked {new Date(linkedAccount.linked_at).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Not connected</p>
                        )}
                      </div>
                    </div>

                    {isLinked && linkedAccount ? (
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Connected
                        </span>
                        {!linkedAccount.is_primary && (
                          <button
                            onClick={() => unlinkOAuthMutation.mutate({
                              provider: linkedAccount.provider,
                              external_id: linkedAccount.external_id
                            })}
                            disabled={unlinkOAuthMutation.isPending}
                            className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            Disconnect
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleOAuthLink(provider.id)}
                        className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${provider.color}`}
                      >
                        Connect {provider.name}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Help text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    <strong>Connect your accounts</strong> to use them for authentication and access control.
                    You can safely connect multiple accounts and disconnect them at any time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>


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