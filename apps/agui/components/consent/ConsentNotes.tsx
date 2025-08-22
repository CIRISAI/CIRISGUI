import React from 'react';

export function ConsentNotes() {
  return (
    <div className="space-y-4">
      {/* Consent Creation Timeline */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Consent Record Creation
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Consent records are automatically created <strong>6-12 hours after your first Discord interaction</strong> with CIRIS.
                This delay ensures meaningful engagement before establishing a consent relationship.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stream Change Notes */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-amber-800">
              Important Consent Rules
            </h3>
            <div className="mt-2 text-sm text-amber-700 space-y-2">
              <p>
                <strong>Downgrades:</strong> Switching to TEMPORARY or ANONYMOUS creates a proactive opt-out and takes effect immediately.
              </p>
              <p>
                <strong>Partnership Upgrades:</strong> Always require mutual consent from both you and the agent. The agent must approve your partnership request.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Note */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-gray-800">
              Privacy & Access Control
            </h3>
            <div className="mt-2 text-sm text-gray-700">
              <p>
                You can only view and manage your own consent settings. Administrators can view consent records for all users for compliance purposes, but cannot modify them.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PendingPartnershipBanner({ 
  partnershipRequests 
}: { 
  partnershipRequests?: Array<{
    from: 'agent' | 'user';
    timestamp: string;
    message?: string;
  }> 
}) {
  if (!partnershipRequests || partnershipRequests.length === 0) return null;

  const agentRequests = partnershipRequests.filter(r => r.from === 'agent');
  
  if (agentRequests.length === 0) return null;

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <div className="relative">
            <svg className="h-6 w-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
            </svg>
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-400 rounded-full animate-pulse"></span>
          </div>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-green-800">
            Partnership Request from Agent
          </h3>
          <div className="mt-2 text-sm text-green-700">
            <p>
              The agent has requested to establish a partnership with you! This would enable:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Enhanced personalization based on your preferences</li>
              <li>Long-term memory of your interactions</li>
              <li>Mutual growth and learning</li>
            </ul>
            {agentRequests[0].message && (
              <p className="mt-3 italic">
                "{agentRequests[0].message}"
              </p>
            )}
            <div className="mt-4 flex space-x-3">
              <button className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                Accept Partnership
              </button>
              <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Decline
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}