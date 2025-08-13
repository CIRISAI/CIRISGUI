'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { cirisClient } from '../../lib/ciris-sdk';
import type { UserDetail, APIRole } from '../../lib/ciris-sdk';
import { useAuth } from '../../contexts/AuthContext';
import { XMarkIcon, ShieldCheckIcon, KeyIcon, TrashIcon } from '../Icons';

interface UserDetailsModalProps {
  user: UserDetail;
  onClose: () => void;
  onPasswordChange: () => void;
  onMintWA: () => void;
  onUpdate: () => void;
}

export function UserDetailsModal({ user, onClose, onPasswordChange, onMintWA, onUpdate }: UserDetailsModalProps) {
  const { hasRole } = useAuth();
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editRole, setEditRole] = useState(false);
  const [newRole, setNewRole] = useState<APIRole>(user.api_role);

  const handleRoleUpdate = async () => {
    try {
      setUpdating(true);
      setError(null);
      await cirisClient.users.update(user.user_id, { api_role: newRole });
      setEditRole(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;

    try {
      setUpdating(true);
      setError(null);
      await cirisClient.users.deactivate(user.user_id);
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate user');
    } finally {
      setUpdating(false);
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
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                  <div className="absolute right-0 top-0 pr-4 pt-4">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                      onClick={onClose}
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon size="lg" className="text-gray-400" />
                    </button>
                  </div>

                  <div>
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                      User Details
                    </Dialog.Title>

                    {error && (
                      <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                        <p className="text-sm text-red-600">{error}</p>
                      </div>
                    )}

                    <div className="mt-6 space-y-6">
                      {/* Basic Info */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Basic Information</h4>
                        <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Username</dt>
                            <dd className="mt-1 text-sm text-gray-900">{user.username}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">User ID</dt>
                            <dd className="mt-1 text-sm text-gray-900 font-mono text-xs">{user.user_id}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Auth Type</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                              {user.auth_type}
                              {user.oauth_provider && ` (${user.oauth_provider})`}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Email</dt>
                            <dd className="mt-1 text-sm text-gray-900">{user.oauth_email || '—'}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Created</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                              {new Date(user.created_at).toLocaleString()}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Last Login</dt>
                            <dd className="mt-1 text-sm text-gray-900">
                              {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {/* Roles */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Roles & Permissions</h4>
                        <dl className="space-y-3">
                          <div>
                            <dt className="text-sm font-medium text-gray-500">API Role</dt>
                            <dd className="mt-1 flex items-center">
                              {editRole ? (
                                <div className="flex items-center space-x-2">
                                  <select
                                    value={newRole}
                                    onChange={(e) => setNewRole(e.target.value as APIRole)}
                                    className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                  >
                                    <option value="OBSERVER">Observer</option>
                                    <option value="ADMIN">Admin</option>
                                    <option value="AUTHORITY">Authority</option>
                                    <option value="SYSTEM_ADMIN">System Admin</option>
                                  </select>
                                  <button
                                    onClick={handleRoleUpdate}
                                    disabled={updating}
                                    className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditRole(false);
                                      setNewRole(user.api_role);
                                    }}
                                    className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                    {user.api_role}
                                  </span>
                                  {hasRole('SYSTEM_ADMIN') && (
                                    <button
                                      onClick={() => setEditRole(true)}
                                      className="text-sm text-indigo-600 hover:text-indigo-900"
                                    >
                                      Edit
                                    </button>
                                  )}
                                </div>
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-sm font-medium text-gray-500">WA Status</dt>
                            <dd className="mt-1 flex items-center justify-between">
                              {user.wa_role ? (
                                <div className="flex items-center space-x-2">
                                  <ShieldCheckIcon size="md" className="text-purple-600" />
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 ring-2 ring-purple-600">
                                    {user.wa_role.toUpperCase()}
                                  </span>
                                  {user.wa_parent_id && (
                                    <span className="text-xs text-gray-500">
                                      Minted by: {user.wa_parent_id}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500">Not a Wise Authority</span>
                              )}
                              {hasRole('SYSTEM_ADMIN') && !user.wa_role && (
                                <button
                                  onClick={onMintWA}
                                  className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-purple-700 bg-purple-100 hover:bg-purple-200"
                                >
                                  <ShieldCheckIcon size="sm" className="mr-1" />
                                  Mint as WA
                                </button>
                              )}
                            </dd>
                          </div>

                          <div>
                            <dt className="text-sm font-medium text-gray-500">API Keys</dt>
                            <dd className="mt-1 text-sm text-gray-900">{user.api_keys_count} active keys</dd>
                          </div>

                          <div>
                            <dt className="text-sm font-medium text-gray-500">Permissions</dt>
                            <dd className="mt-1">
                              <div className="max-h-32 overflow-y-auto">
                                <ul className="text-xs space-y-1">
                                  {user.permissions.map((perm) => (
                                    <li key={perm} className="text-gray-600">• {perm}</li>
                                  ))}
                                </ul>
                              </div>
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {/* Actions */}
                      <div className="border-t pt-6">
                        <div className="flex flex-wrap gap-2">
                          {user.auth_type === 'password' && (
                            <button
                              onClick={onPasswordChange}
                              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                              <KeyIcon size="sm" className="mr-2" />
                              Change Password
                            </button>
                          )}

                          {hasRole('SYSTEM_ADMIN') && user.is_active && (
                            <button
                              onClick={handleDeactivate}
                              disabled={updating}
                              className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                            >
                              <TrashIcon size="sm" className="mr-2" />
                              Deactivate User
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
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
