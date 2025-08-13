'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { cirisClient } from '../../lib/ciris-sdk';
import type { UserSummary, UserDetail, PaginatedUsers, APIRole, WARole } from '../../lib/ciris-sdk';
import { UserDetailsModal } from '../../components/users/UserDetailsModal';
import { PasswordChangeModal } from '../../components/users/PasswordChangeModal';
import { WAMintModal } from '../../components/users/WAMintModal';
import { OAuthConfigModal } from '../../components/users/OAuthConfigModal';
import { AddUserModal } from '../../components/users/AddUserModal';
import { ChevronRightIcon, KeyIcon, UserPlusIcon, ShieldCheckIcon } from '../../components/Icons';

export default function UsersPage() {
  const { hasRole } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [passwordChangeUser, setPasswordChangeUser] = useState<UserDetail | null>(null);
  const [waMintUser, setWAMintUser] = useState<UserDetail | null>(null);
  const [showOAuthConfig, setShowOAuthConfig] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<APIRole | ''>('');
  const [filterAuthType, setFilterAuthType] = useState<string>('');

  useEffect(() => {
    loadUsers();
  }, [page, searchTerm, filterRole, filterAuthType]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await cirisClient.users.list({
        page,
        page_size: 20,
        search: searchTerm || undefined,
        api_role: filterRole || undefined,
        auth_type: filterAuthType || undefined,
      });

      setUsers(response.items);
      setTotalPages(response.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetails = async (userId: string) => {
    try {
      const details = await cirisClient.users.get(userId);
      setSelectedUser(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user details');
    }
  };

  const getRoleBadgeColor = (role: APIRole) => {
    switch (role) {
      case 'SYSTEM_ADMIN':
        return 'bg-red-100 text-red-800';
      case 'AUTHORITY':
        return 'bg-purple-100 text-purple-800';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getWARoleBadgeColor = (role: WARole) => {
    switch (role) {
      case 'AUTHORITY':
        return 'bg-purple-100 text-purple-800 ring-2 ring-purple-600';
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800 ring-2 ring-blue-600';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
            <p className="mt-2 text-sm text-gray-700">
              Manage users, roles, and Wise Authority assignments
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none space-x-2">
            {hasRole('SYSTEM_ADMIN') && (
              <>
                <button
                  onClick={() => setShowOAuthConfig(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <KeyIcon size="md" className="-ml-1 mr-2 text-gray-500" />
                  OAuth Config
                </button>
                <button
                  onClick={() => setShowAddUser(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  <UserPlusIcon size="md" className="-ml-1 mr-2" />
                  Add User
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">
              Search
            </label>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Search by name..."
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
              API Role
            </label>
            <select
              id="role"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as APIRole | '')}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Roles</option>
              <option value="OBSERVER">Observer</option>
              <option value="ADMIN">Admin</option>
              <option value="AUTHORITY">Authority</option>
              <option value="SYSTEM_ADMIN">System Admin</option>
            </select>
          </div>

          <div>
            <label htmlFor="auth-type" className="block text-sm font-medium text-gray-700">
              Auth Type
            </label>
            <select
              id="auth-type"
              value={filterAuthType}
              onChange={(e) => setFilterAuthType(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Types</option>
              <option value="password">Password</option>
              <option value="oauth">OAuth</option>
              <option value="api_key">API Key</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                {loading ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center">
                      <svg className="animate-spin h-5 w-5 mr-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Loading users...
                    </div>
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <p className="text-red-600">{error}</p>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          User
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Auth Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          API Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          WA Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Login
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.user_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {user.username}
                              </div>
                              <div className="text-sm text-gray-500">
                                {user.oauth_email || user.user_id}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm text-gray-900">
                                {user.auth_type}
                              </span>
                              {user.oauth_provider && (
                                <span className="ml-2 text-xs text-gray-500">
                                  ({user.oauth_provider})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(user.api_role)}`}>
                              {user.api_role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.wa_role ? (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getWARoleBadgeColor(user.wa_role)}`}>
                                <ShieldCheckIcon size="xs" className="mr-1" />
                                {user.wa_role.toUpperCase()}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {user.is_active ? (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold text-green-800 bg-green-100 rounded-full">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold text-red-800 bg-red-100 rounded-full">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => loadUserDetails(user.user_id)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              <ChevronRightIcon size="md" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Page <span className="font-medium">{page}</span> of{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onPasswordChange={() => {
            setPasswordChangeUser(selectedUser);
            setSelectedUser(null);
          }}
          onMintWA={() => {
            setWAMintUser(selectedUser);
            setSelectedUser(null);
          }}
          onUpdate={() => {
            loadUsers();
            loadUserDetails(selectedUser.user_id);
          }}
        />
      )}

      {/* Password Change Modal */}
      {passwordChangeUser && (
        <PasswordChangeModal
          userId={passwordChangeUser.user_id}
          username={passwordChangeUser.username}
          onClose={() => setPasswordChangeUser(null)}
          onSuccess={() => {
            setPasswordChangeUser(null);
            loadUsers();
          }}
        />
      )}

      {/* WA Mint Modal */}
      {waMintUser && (
        <WAMintModal
          user={waMintUser}
          onClose={() => setWAMintUser(null)}
          onSuccess={() => {
            setWAMintUser(null);
            loadUsers();
          }}
        />
      )}

      {/* OAuth Config Modal */}
      {showOAuthConfig && (
        <OAuthConfigModal
          onClose={() => setShowOAuthConfig(false)}
        />
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <AddUserModal
          onClose={() => setShowAddUser(false)}
          onSuccess={() => {
            setShowAddUser(false);
            loadUsers();
          }}
        />
      )}
    </ProtectedRoute>
  );
}
