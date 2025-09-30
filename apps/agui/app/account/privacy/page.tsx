"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { cirisClient } from "../../../lib/ciris-sdk";
import { ProtectedRoute } from "../../../components/ProtectedRoute";
import { DSARRequest, DSARTicket } from "../../../lib/ciris-sdk/resources/dsar";
import { extractErrorMessage } from "../../../lib/utils/error-helpers";
import Link from "next/link";

function PrivacyPageContent() {
  const { user } = useAuth();
  const [dsarRequests, setDsarRequests] = useState<DSARTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [formData, setFormData] = useState<DSARRequest>({
    request_type: 'access',
    email: user?.username || '',
    details: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Load existing DSAR requests if user is admin
  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN') {
      fetchDsarRequests();
    }
  }, [user]);

  const fetchDsarRequests = async () => {
    setLoading(true);
    try {
      const requests = await cirisClient.dsar.listRequests();
      setDsarRequests(requests);
    } catch (error: any) {
      console.error("Failed to fetch DSAR requests:", error);
      // Don't alert here as this is just for admin visibility
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await cirisClient.dsar.submitRequest(formData);
      alert(`DSAR request submitted successfully! Ticket ID: ${response.ticket_id}`);
      setShowRequestForm(false);
      setFormData({
        request_type: 'access',
        email: user?.username || '',
        details: ''
      });

      // Refresh the list if admin
      if (user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN') {
        fetchDsarRequests();
      }
    } catch (error: any) {
      console.error("Failed to submit DSAR request:", error);
      const errorMessage = extractErrorMessage(error);
      alert(`Failed to submit request: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getRequestTypeDisplay = (type: string) => {
    switch (type) {
      case 'access': return { text: 'Data Access', icon: '👁️', color: 'blue' };
      case 'delete': return { text: 'Data Deletion', icon: '🗑️', color: 'red' };
      case 'export': return { text: 'Data Export', icon: '📦', color: 'green' };
      case 'correct': return { text: 'Data Correction', icon: '✏️', color: 'yellow' };
      default: return { text: type, icon: '📋', color: 'gray' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header with navigation */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Account</h1>
                <p className="mt-1 text-sm text-gray-600">
                  Manage your account settings and privacy preferences
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8">
              <Link
                href="/account"
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
              >
                Details
              </Link>
              <Link
                href="/account/consent"
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
              >
                Consent
              </Link>
              <span className="border-indigo-500 text-indigo-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                Privacy & Data
              </span>
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Privacy overview */}
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Privacy & Data Rights</h2>
            <p className="text-gray-600 mb-4">
              Under GDPR and other privacy regulations, you have specific rights regarding your personal data.
              Use the Data Subject Access Request (DSAR) system to exercise these rights.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="text-2xl mb-2">👁️</div>
                <h3 className="font-medium text-gray-900">Access</h3>
                <p className="text-sm text-gray-600">Request a copy of your personal data</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl mb-2">🗑️</div>
                <h3 className="font-medium text-gray-900">Deletion</h3>
                <p className="text-sm text-gray-600">Request deletion of your personal data</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl mb-2">📦</div>
                <h3 className="font-medium text-gray-900">Export</h3>
                <p className="text-sm text-gray-600">Export your data in a portable format</p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="text-2xl mb-2">✏️</div>
                <h3 className="font-medium text-gray-900">Correction</h3>
                <p className="text-sm text-gray-600">Request correction of inaccurate data</p>
              </div>
            </div>
          </div>

          {/* Request form */}
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Submit Data Request</h2>
              {!showRequestForm && (
                <button
                  onClick={() => setShowRequestForm(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700"
                >
                  New Request
                </button>
              )}
            </div>

            {showRequestForm && (
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Request Type
                    </label>
                    <select
                      value={formData.request_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, request_type: e.target.value as any }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    >
                      <option value="access">Data Access</option>
                      <option value="delete">Data Deletion</option>
                      <option value="export">Data Export</option>
                      <option value="correct">Data Correction</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    User Identifier (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.user_identifier || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, user_identifier: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Discord ID, username, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Request Details
                  </label>
                  <textarea
                    value={formData.details || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, details: e.target.value }))}
                    rows={4}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Please provide specific details about your request..."
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.urgent || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, urgent: e.target.checked }))}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">
                    Urgent request (requires justification in details)
                  </label>
                </div>

                <div className="flex items-center space-x-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestForm(false);
                      setFormData({
                        request_type: 'access',
                        email: user?.username || '',
                        details: ''
                      });
                    }}
                    className="text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Admin view: List all DSAR requests */}
          {(user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN') && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">All DSAR Requests (Admin View)</h2>
                <button
                  onClick={fetchDsarRequests}
                  disabled={loading}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {loading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-gray-200 rounded"></div>
                  ))}
                </div>
              ) : dsarRequests.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No DSAR requests found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ticket ID</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Urgent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {dsarRequests.map((request) => {
                        const typeInfo = getRequestTypeDisplay(request.request_type);
                        return (
                          <tr key={request.ticket_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-mono text-gray-900">
                              {request.ticket_id}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center space-x-2">
                                <span>{typeInfo.icon}</span>
                                <span>{typeInfo.text}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {request.email}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(request.status)}`}>
                                {request.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(request.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {request.urgent && (
                                <span className="text-red-600 font-medium">⚠️ Urgent</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Privacy notice */}
          <div className="mt-8 text-center text-xs text-gray-500">
            <p>
              DSAR requests are processed according to applicable privacy regulations.
              Response times may vary based on request complexity and legal requirements.
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function PrivacyPage() {
  return <PrivacyPageContent />;
}