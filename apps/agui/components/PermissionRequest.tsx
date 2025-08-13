'use client';

import React, { useState } from 'react';
import { CIRISPermissionDeniedError } from '../lib/ciris-sdk';
import { useAuth } from '../contexts/AuthContext';

interface PermissionRequestProps {
  error?: CIRISPermissionDeniedError;
  onRequestPermissions?: () => Promise<void>;
}

export default function PermissionRequest({ error, onRequestPermissions }: PermissionRequestProps) {
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const { user } = useAuth();

  const handleRequestPermissions = async () => {
    if (!onRequestPermissions) return;

    setIsRequesting(true);
    setRequestError(null);

    try {
      await onRequestPermissions();
      setRequestSuccess(true);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : 'Failed to request permissions');
    } finally {
      setIsRequesting(false);
    }
  };

  const discordInvite = error?.discordInvite || 'https://discord.gg/4PRs9TJj';
  const canRequest = error?.canRequestPermissions ?? true;
  const alreadyRequested = error?.permissionRequested || requestSuccess;
  const requestedAt = error?.requestedAt;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-medium text-red-900">
            Permission Required
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{error?.message || 'You need permission to send messages to this agent.'}</p>
          </div>

          {/* Discord Invite Section */}
          <div className="mt-4 bg-white rounded-md p-4 border border-red-200">
            <p className="text-sm text-gray-700 mb-3">
              Join our Discord community to get help and connect with other users:
            </p>
            <a
              href={discordInvite}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Join Discord Community
            </a>
          </div>

          {/* Permission Request Section */}
          {user && (
            <div className="mt-4">
              {alreadyRequested ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800">
                    <span className="font-medium">Permission request submitted!</span>
                    {requestedAt && (
                      <span className="block mt-1 text-xs">
                        Requested on: {new Date(requestedAt).toLocaleString()}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-yellow-700 mt-2">
                    An administrator will review your request. You can also reach out on Discord for faster assistance.
                  </p>
                </div>
              ) : canRequest ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Or request permission directly through the system:
                  </p>
                  <button
                    onClick={handleRequestPermissions}
                    disabled={isRequesting}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRequesting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Requesting...
                      </>
                    ) : (
                      'Request Permission'
                    )}
                  </button>
                  {requestError && (
                    <p className="text-sm text-red-600">{requestError}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 mt-3 italic">
                  Please join our Discord community for assistance with permissions.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
