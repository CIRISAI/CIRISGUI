'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cirisClient } from '../../lib/ciris-sdk';
import { Deferral } from '../../lib/ciris-sdk/resources/wise-authority';
import type { UserDetail } from '../../lib/ciris-sdk';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { ShieldIcon, ExclamationTriangleIcon } from '../../components/Icons';

export default function WAPage() {
  const { user, hasRole } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedDeferral, setSelectedDeferral] = useState<Deferral | null>(null);
  const [expandedDeferral, setExpandedDeferral] = useState<string | null>(null);
  const [decision, setDecision] = useState<'approve' | 'deny'>('approve');
  const [reasoning, setReasoning] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('pending');
  const [sortBy, setSortBy] = useState<'timestamp' | 'urgency' | 'type'>('timestamp');
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [showSignatureHelp, setShowSignatureHelp] = useState(false);
  const [signature, setSignature] = useState('');

  // Check access - allow admins or authorities to view
  useEffect(() => {
    if (user && !hasRole('ADMIN') && !hasRole('AUTHORITY')) {
      toast.error('Access denied. Admin or Authority role required.');
      router.push('/');
    }
  }, [user, hasRole, router]);

  // Fetch detailed user info to check WA status
  useEffect(() => {
    if (user) {
      loadUserDetail();
    }
  }, [user]);

  const loadUserDetail = async () => {
    try {
      const detail = await cirisClient.users.get(user!.user_id);
      setUserDetail(detail);
    } catch (error) {
      console.error('Failed to load user details:', error);
    }
  };

  // Fetch deferrals
  const { data: deferrals = [], isLoading } = useQuery({
    queryKey: ['deferrals'],
    queryFn: () => cirisClient.wiseAuthority.getDeferrals(),
    refetchInterval: 5000, // Refresh every 5 seconds
    enabled: hasRole('ADMIN') || hasRole('AUTHORITY'), // Allow admins and authorities to view
  });

  // Check if user can resolve deferrals (must be a minted WA)
  const canResolve = userDetail?.wa_role === 'AUTHORITY' || userDetail?.wa_role === 'ADMIN';

  // Resolve deferral mutation
  const resolveMutation = useMutation({
    mutationFn: ({ deferral_id, decision, reasoning, signature }: { deferral_id: string; decision: string; reasoning: string; signature: string }) =>
      cirisClient.wiseAuthority.resolveDeferral(deferral_id, decision, reasoning, signature),
    onSuccess: () => {
      toast.success('Deferral resolved successfully');
      queryClient.invalidateQueries({ queryKey: ['deferrals'] });
      setExpandedDeferral(null);
      setSelectedDeferral(null);
      setReasoning('');
      setDecision('approve');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to resolve deferral');
    },
  });

  // Filter deferrals
  const filteredDeferrals = deferrals.filter((d) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return d.status === 'pending';
    if (filter === 'resolved') return d.status === 'approved' || d.status === 'rejected';
    return true;
  });

  // Sort deferrals
  const sortedDeferrals = [...filteredDeferrals].sort((a, b) => {
    if (sortBy === 'timestamp') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    // Urgency sorting not supported by SDK Deferral type
    return 0;
  });

  // Stats calculation
  const stats = {
    total: deferrals.length,
    pending: deferrals.filter((d) => d.status === 'pending').length,
    approved: deferrals.filter((d) => d.status === 'approved').length,
    denied: deferrals.filter((d) => d.status === 'rejected').length,
    resolutionRate: deferrals.length > 0
      ? ((deferrals.filter((d) => d.status === 'approved' || d.status === 'rejected').length / deferrals.length) * 100).toFixed(1)
      : 0,
  };

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  const getRiskBadgeClasses = (level?: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-blue-100 text-blue-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'denied': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleResolve = () => {
    if (!selectedDeferral || !reasoning.trim()) {
      toast.error('Please provide reasoning for your decision');
      return;
    }
    // Use a placeholder signature - the server should validate based on the authenticated user
    resolveMutation.mutate({
      deferral_id: selectedDeferral.deferral_id,
      decision,
      reasoning,
      signature: 'server-will-sign', // Server should sign with stored WA key
    });
  };

  if (!hasRole('ADMIN') && !hasRole('AUTHORITY')) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white shadow">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Wise Authority Dashboard</h2>
              <p className="mt-1 text-sm text-gray-500">
                Review and resolve deferred decisions requiring authority oversight
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {userDetail?.wa_role ? (
                <div className="flex items-center space-x-2 bg-purple-50 px-4 py-2 rounded-lg">
                  <ShieldIcon size="sm" className="text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">
                    WA {userDetail.wa_role.toUpperCase()}
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 bg-yellow-50 px-4 py-2 rounded-lg">
                  <ExclamationTriangleIcon size="sm" className="text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-900">
                    View Only (Not a WA)
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Deferrals</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.total}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
            <dd className="mt-1 text-3xl font-semibold text-blue-600">{stats.pending}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Approved</dt>
            <dd className="mt-1 text-3xl font-semibold text-green-600">{stats.approved}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Denied</dt>
            <dd className="mt-1 text-3xl font-semibold text-red-600">{stats.denied}</dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Resolution Rate</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">{stats.resolutionRate}%</dd>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Filter:</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="all">All Deferrals</option>
                <option value="pending">Pending Only</option>
                <option value="resolved">Resolved Only</option>
              </select>
            </div>
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="timestamp">Date (Newest First)</option>
                <option value="urgency">Urgency (Critical First)</option>
                <option value="type">Type</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Deferrals List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Deferred Decisions</h3>
            {!canResolve && (
              <div className="text-sm text-yellow-600 bg-yellow-50 px-3 py-1 rounded-md">
                ⚠️ Mint yourself as a WA in the Users page to resolve deferrals
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading deferrals...</p>
            </div>
          ) : sortedDeferrals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No deferrals found matching your criteria.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDeferrals.map((deferral) => (
                <div
                  key={deferral.deferral_id}
                  className={`border rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer ${
                    selectedDeferral?.deferral_id === deferral.deferral_id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedDeferral(deferral)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h4 className="text-sm font-semibold text-gray-900">
                          Thought ID: {deferral.thought_id}
                        </h4>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClasses(deferral.status)}`}>
                          {deferral.status.toUpperCase()}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 mb-2">{deferral.question}</p>

                      <div className="flex items-center text-xs text-gray-500 space-x-4">
                        <span>{new Date(deferral.created_at).toLocaleString()}</span>
                      </div>

                      {deferral.resolution && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-md">
                          <p className="text-xs font-medium text-gray-700">
                            Resolution: <span className={deferral.resolution.decision === 'approve' ? 'text-green-600' : 'text-red-600'}>
                              {deferral.resolution.decision.toUpperCase()}
                            </span>
                          </p>
                          <p className="text-xs text-gray-600 mt-1">{deferral.resolution.reasoning}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            by {deferral.resolution.resolved_by} {deferral.resolved_at && `at ${new Date(deferral.resolved_at).toLocaleString()}`}
                          </p>
                        </div>
                      )}
                    </div>

                    {deferral.status === 'pending' && canResolve && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDeferral(deferral);
                          setExpandedDeferral(expandedDeferral === deferral.deferral_id ? null : deferral.deferral_id);
                        }}
                        className="ml-4 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Resolve
                      </button>
                    )}
                    {deferral.status === 'pending' && !canResolve && (
                      <span className="ml-4 text-xs text-gray-500 italic">
                        WA authority required to resolve
                      </span>
                    )}
                  </div>

                  {/* Inline Resolution Form */}
                  {expandedDeferral === deferral.deferral_id && canResolve && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-md border border-gray-200">
                      <h4 className="text-sm font-medium text-gray-900 mb-3">Resolve Deferral</h4>

                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Decision</label>
                          <div className="mt-1 flex items-center space-x-4">
                            <label className="inline-flex items-center">
                              <input
                                type="radio"
                                className="form-radio text-green-600"
                                value="approve"
                                checked={decision === 'approve'}
                                onChange={(e) => setDecision(e.target.value as 'approve')}
                              />
                              <span className="ml-2 text-sm text-gray-700">Approve</span>
                            </label>
                            <label className="inline-flex items-center">
                              <input
                                type="radio"
                                className="form-radio text-red-600"
                                value="deny"
                                checked={decision === 'deny'}
                                onChange={(e) => setDecision(e.target.value as 'deny')}
                              />
                              <span className="ml-2 text-sm text-gray-700">Deny</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <label htmlFor={`reasoning-${deferral.deferral_id}`} className="block text-sm font-medium text-gray-700">
                            Reasoning
                          </label>
                          <textarea
                            id={`reasoning-${deferral.deferral_id}`}
                            rows={3}
                            className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder="Provide detailed reasoning for your decision..."
                            value={reasoning}
                            onChange={(e) => setReasoning(e.target.value)}
                          />
                        </div>

                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => {
                              setExpandedDeferral(null);
                              setReasoning('');
                              setDecision('approve');
                            }}
                            className="px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleResolve()}
                            disabled={!reasoning.trim() || resolveMutation.isPending}
                            className="px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {resolveMutation.isPending ? 'Resolving...' : 'Submit Resolution'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected Deferral Details */}
      {selectedDeferral && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Deferral Details</h3>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-700">Thought ID</h4>
                <p className="mt-1 text-sm font-mono text-gray-600">{selectedDeferral.thought_id}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700">Question</h4>
                <p className="mt-1 text-sm text-gray-600">{selectedDeferral.question}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-700">Context</h4>
                <pre className="mt-1 text-sm text-gray-600 bg-gray-50 p-3 rounded-md overflow-x-auto">
                  {JSON.stringify(selectedDeferral.context, null, 2)}
                </pre>
              </div>

              {canResolve && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setExpandedDeferral(selectedDeferral?.deferral_id || null)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Resolve Deferral
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Provide Guidance Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Provide Guidance</h3>
          <p className="text-sm text-gray-500 mb-4">
            {canResolve
              ? "As a Wise Authority, you can provide guidance on any topic to help the system make better decisions."
              : "Once you are minted as a Wise Authority, you can provide guidance to help the system."}
          </p>

          {canResolve ? (
            <button
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
            >
              Provide Unsolicited Guidance
            </button>
          ) : (
            <button
              onClick={() => router.push('/users')}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Go to Users Page to Get Minted
            </button>
          )}
        </div>
      </div>

      {/* Resolution Modal - Removed, using inline resolution instead */}
      {false && (
        <div className="fixed z-10 inset-0 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full sm:p-6">
              <div>
                <div className="text-center">
                  <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                    Resolve Deferral
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Review the deferral and provide your decision with reasoning.
                    </p>
                  </div>
                </div>
                <div className="mt-5">
                  <div className="mb-4">
                    <label className="text-sm font-medium text-gray-700">Decision</label>
                    <div className="mt-2 space-x-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          className="form-radio text-green-600"
                          value="approve"
                          checked={decision === 'approve'}
                          onChange={(e) => setDecision(e.target.value as 'approve')}
                        />
                        <span className="ml-2 text-sm text-gray-700">Approve</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          className="form-radio text-red-600"
                          value="deny"
                          checked={decision === 'deny'}
                          onChange={(e) => setDecision(e.target.value as 'deny')}
                        />
                        <span className="ml-2 text-sm text-gray-700">Deny</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reasoning" className="block text-sm font-medium text-gray-700">
                      Reasoning
                    </label>
                    <div className="mt-1">
                      <textarea
                        id="reasoning"
                        rows={4}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                        placeholder="Provide detailed reasoning for your decision..."
                        value={reasoning}
                        onChange={(e) => setReasoning(e.target.value)}
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Your reasoning will be recorded and may be used for future guidance.
                    </p>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <label htmlFor="signature" className="block text-sm font-medium text-gray-700">
                        WA Signature <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowSignatureHelp(!showSignatureHelp)}
                        className="text-xs text-indigo-600 hover:text-indigo-500"
                      >
                        How to sign?
                      </button>
                    </div>
                    <div className="mt-1">
                      <textarea
                        id="signature"
                        rows={2}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md font-mono text-xs"
                        placeholder="Paste your Ed25519 signature here..."
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                      />
                    </div>
                    {showSignatureHelp && (
                      <div className="mt-2 bg-purple-50 rounded-md p-3 text-xs">
                        <h5 className="font-medium text-purple-900 mb-1">Signing Instructions:</h5>
                        <ol className="list-decimal list-inside space-y-1 text-purple-700">
                          <li>Use your WA private key to sign this message:</li>
                          <li className="ml-4">
                            <code className="bg-purple-100 px-1 py-0.5 rounded">
                              RESOLVE:{selectedDeferral?.deferral_id}:{decision}:{reasoning}
                            </code>
                          </li>
                          <li>Paste the base64-encoded signature above</li>
                        </ol>
                        <div className="mt-2 text-purple-800">
                          <strong>Note:</strong> Your signature proves you are an authorized WA making this decision.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                <button
                  type="button"
                  onClick={handleResolve}
                  disabled={!reasoning.trim() || resolveMutation.isPending}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:col-start-2 sm:text-sm ${
                    decision === 'approve'
                      ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                      : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {resolveMutation.isPending ? 'Resolving...' : `${decision === 'approve' ? 'Approve' : 'Deny'} Deferral`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExpandedDeferral(null);
                    setReasoning('');
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
