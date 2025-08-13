'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { cirisClient } from '../../lib/ciris-sdk';
import type { APIRole } from '../../lib/ciris-sdk';
import { UserPlusIcon, XMarkIcon } from '../Icons';

interface AddUserModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AddUserModal({ onClose, onSuccess }: AddUserModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [apiRole, setApiRole] = useState<APIRole>('OBSERVER');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      await cirisClient.users.create({
        username,
        password,
        api_role: apiRole
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setCreating(false);
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
              <Dialog.Panel className="relative w-full max-w-lg max-h-[calc(100vh-2rem)] mx-auto bg-white rounded-lg shadow-xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-5 pb-4 sm:p-6 border-b">
                  <div className="flex items-center space-x-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                      <UserPlusIcon size="md" className="text-indigo-600" />
                    </div>
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Add New User
                    </Dialog.Title>
                  </div>
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
                  <div className="text-center mb-6">
                    <p className="text-sm text-gray-500">
                      Create a new user account with password authentication
                    </p>
                  </div>

                {error && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <form onSubmit={handleCreate} className="mt-6 space-y-4">
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                      Username
                    </label>
                    <input
                      type="text"
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Enter username"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Enter password"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Must be at least 8 characters long
                    </p>
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      id="confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="Confirm password"
                    />
                  </div>

                  <div>
                    <label htmlFor="api-role" className="block text-sm font-medium text-gray-700">
                      API Role
                    </label>
                    <select
                      id="api-role"
                      value={apiRole}
                      onChange={(e) => setApiRole(e.target.value as APIRole)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="OBSERVER">Observer</option>
                      <option value="ADMIN">Admin</option>
                      <option value="AUTHORITY">Authority</option>
                      <option value="SYSTEM_ADMIN">System Admin</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      {apiRole === 'OBSERVER' && 'Can view data but not make changes'}
                      {apiRole === 'ADMIN' && 'Can manage users and configuration'}
                      {apiRole === 'AUTHORITY' && 'Can view WA deferrals and guidance'}
                      {apiRole === 'SYSTEM_ADMIN' && 'Full system access and control'}
                    </p>
                  </div>

                  <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                    <button
                      type="submit"
                      disabled={creating}
                      className="inline-flex w-full justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-2 sm:text-sm disabled:opacity-50"
                    >
                      {creating ? 'Creating...' : 'Create User'}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:col-start-1 sm:mt-0 sm:text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
