'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { cirisClient } from '../../lib/ciris-sdk';
import { useAuth } from '../../contexts/AuthContext';
import { useAgent } from '../../contexts/AgentContextHybrid';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { StatusDot } from '../../components/Icons';
import toast from 'react-hot-toast';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const { currentAgent } = useAgent();

  // Fetch detailed user info from /me endpoint
  const { data: userInfo, isLoading } = useQuery({
    queryKey: ['user-info'],
    queryFn: () => cirisClient.auth.getMe(),
    enabled: !!currentAgent,
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
            Manage your account settings and view profile information
          </p>
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