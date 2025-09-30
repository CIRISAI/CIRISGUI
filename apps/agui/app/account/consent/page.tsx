"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { cirisClient } from "../../../lib/ciris-sdk";
import { ProtectedRoute } from "../../../components/ProtectedRoute";
import PartnershipModal from "../../../components/consent/PartnershipModal";
import { ConsentNotes, PendingPartnershipBanner } from "../../../components/consent/ConsentNotes";
import { ConsentErrorBoundary } from "../../../components/consent/ConsentErrorBoundary";
import { extractErrorMessage } from "../../../lib/utils/error-helpers";
import Link from "next/link";

// Import consent types
interface ConsentStatus {
  user_id: string;
  stream: "temporary" | "partnered" | "anonymous";
  categories: string[];
  granted_at: string;
  expires_at?: string;
  last_modified: string;
  impact_score: number;
  attribution_count: number;
}

interface ConsentStream {
  name: string;
  description: string;
  duration_days?: number;
  auto_forget: boolean;
  learning_enabled: boolean;
  identity_removed?: boolean;
  requires_categories?: boolean;
}

function ConsentPageContent() {
  const { user } = useAuth();
  const [consentStatus, setConsentStatus] = useState<ConsentStatus | null>(null);
  const [streams, setStreams] = useState<Record<string, ConsentStream>>({});
  const [loading, setLoading] = useState(true);
  const [selectedStream, setSelectedStream] = useState<string | null>(null);
  const [partnershipPending, setPartnershipPending] = useState(false);
  const [showPartnershipModal, setShowPartnershipModal] = useState(false);
  const [partnershipStatus, setPartnershipStatus] = useState<string>("none");
  const [hasConsent, setHasConsent] = useState(true);
  const [agentPartnershipRequests, setAgentPartnershipRequests] = useState<any[]>([]);

  // Fetch current consent status
  useEffect(() => {
    const fetchConsentData = async () => {
      try {
        // Get current status - handle new API format
        try {
          const statusResponse = await cirisClient.consent.getStatus();
          setHasConsent(true);
          setConsentStatus(statusResponse);
        } catch (error: any) {
          // If 404 or no consent exists
          console.log('[Consent] Error fetching status:', error);
          if (error?.status === 404 || 
              error?.response?.status === 404 || 
              error?.message?.toLowerCase().includes('not found') ||
              error?.message?.toLowerCase().includes('404')) {
            console.log('[Consent] No consent record found (404), this is normal for new users');
            setHasConsent(false);
            setConsentStatus(null);
          } else {
            throw error;
          }
        }

        // Get available streams
        const streamsResponse = await cirisClient.consent.getStreams();
        setStreams(streamsResponse.streams);

        // Check for pending partnership - including agent requests
        const partnershipResponse = await cirisClient.consent.getPartnershipStatus();
        setPartnershipStatus(partnershipResponse.partnership_status);
        setPartnershipPending(partnershipResponse.partnership_status === "pending");
        
        // Check if agent has requested partnership (deferred status means agent wants to discuss)
        if (partnershipResponse.partnership_status === "deferred") {
          setAgentPartnershipRequests([{
            from: 'agent',
            timestamp: new Date().toISOString(),
            message: partnershipResponse.message || "The agent would like to establish a partnership with you."
          }]);
        }
      } catch (error: any) {
        console.error("❌ Failed to fetch consent data:", error);
        const errorMessage = extractErrorMessage(error);
        alert(`Failed to load consent data: ${errorMessage}`);
        // Re-throw to make it fail fast and loud
        throw error;
      } finally {
        setLoading(false);
      }
    };

    fetchConsentData();
  }, []);

  // Poll for partnership status when pending
  useEffect(() => {
    if (!partnershipPending) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await cirisClient.consent.getPartnershipStatus();
        
        setPartnershipStatus(response.partnership_status);
        
        if (response.partnership_status !== "pending") {
          setPartnershipPending(false);
          
          // Refresh consent status if approved
          if (response.partnership_status === "accepted") {
            const statusResponse = await cirisClient.consent.getStatus();
            setConsentStatus(statusResponse);
            
            // Show success notification
            alert("Partnership approved! You now have PARTNERED consent.");
          } else if (response.partnership_status === "rejected") {
            alert("Partnership request was declined by the agent.");
          }
        }
      } catch (error: any) {
        console.error("❌ Failed to poll partnership status:", error);
        const errorMessage = extractErrorMessage(error);
        alert(`Failed to check partnership status: ${errorMessage}`);
        setPartnershipPending(false); // Stop polling on error
        clearInterval(pollInterval);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [partnershipPending]);

  // Handle stream selection
  const handleStreamSelect = useCallback(async (streamKey: string) => {
    if (streamKey === consentStatus?.stream) return;

    if (streamKey === "partnered") {
      // Show partnership modal for PARTNERED stream
      setShowPartnershipModal(true);
    } else {
      // Direct stream change for TEMPORARY or ANONYMOUS (creates proactive opt-out)
      try {
        const confirmMessage = streamKey === "anonymous" 
          ? "Switching to ANONYMOUS will create a proactive opt-out and anonymize your data. Continue?"
          : "Switching to TEMPORARY will create a proactive opt-out with 14-day auto-forget. Continue?";
        
        if (!confirm(confirmMessage)) return;
        
        const response = await cirisClient.consent.grantConsent({
          stream: streamKey as any,
          categories: [],
          reason: `User proactively opted for ${streamKey} consent (opt-out)`,
        });
        
        setConsentStatus(response);
        alert(`Successfully switched to ${streamKey.toUpperCase()} consent mode. This creates a proactive opt-out.`);
      } catch (error: any) {
        console.error("❌ Failed to change consent stream:", error);
        const errorMessage = extractErrorMessage(error);
        alert(`Failed to change consent stream: ${errorMessage}`);
        // Log full error for debugging
        console.error("Full error object:", {
          status: error?.status,
          detail: error?.detail,
          message: error?.message,
          type: error?.type,
          stack: error?.stack
        });
      }
    }
  }, [consentStatus]);

  // Handle partnership request success
  const handlePartnershipSuccess = useCallback(() => {
    setPartnershipPending(true);
    setShowPartnershipModal(false);
    alert("Partnership request submitted! The agent will review your request.");
  }, []);

  // Calculate time remaining for TEMPORARY consent
  const getTimeRemaining = () => {
    if (!consentStatus || consentStatus.stream !== "temporary" || !consentStatus.expires_at) {
      return null;
    }

    const expiresAt = new Date(consentStatus.expires_at);
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    
    if (diffMs <= 0) return "Expired";
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    return `${days} days, ${hours} hours`;
  };

  const getStreamIcon = (stream: string) => {
    switch (stream) {
      case "temporary":
        return "🛡️";
      case "partnered":
        return "🤝";
      case "anonymous":
        return "👤";
      default:
        return "📋";
    }
  };

  const getStreamColor = (stream: string) => {
    switch (stream) {
      case "temporary":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "partnered":
        return "bg-green-100 text-green-800 border-green-300";
      case "anonymous":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading consent settings...</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

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
              
              {consentStatus && (
                <div className={`px-4 py-2 rounded-lg border ${getStreamColor(consentStatus.stream)}`}>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{getStreamIcon(consentStatus.stream)}</span>
                    <div>
                      <div className="font-semibold capitalize">
                        {consentStatus.stream} Mode
                      </div>
                      {consentStatus.stream === "temporary" && (
                        <div className="text-xs">
                          Expires in: {getTimeRemaining()}
                        </div>
                      )}
                      {partnershipPending && (
                        <div className="text-xs animate-pulse">
                          Partnership request pending...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
              <span className="border-indigo-500 text-indigo-600 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">
                Consent
              </span>
              <Link
                href="/account/privacy"
                className="border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm"
              >
                Privacy & Data
              </Link>
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* No consent notice */}
          {!hasConsent && (
            <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-yellow-900 mb-2">
                Consent Record Not Yet Created
              </h3>
              <p className="text-yellow-700">
                Your consent record will be automatically created 6-12 hours after your first Discord interaction with CIRIS. 
                This ensures meaningful engagement before establishing a consent relationship.
              </p>
            </div>
          )}

          {/* Pending partnership from agent */}
          <PendingPartnershipBanner partnershipRequests={agentPartnershipRequests} />

          {/* Consent notes */}
          <div className="mb-8">
            <ConsentNotes />
          </div>

          {/* Stream selection cards */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Choose Your Consent Stream</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(streams).map(([key, stream]) => (
                <StreamCard
                  key={key}
                  streamKey={key}
                  stream={stream}
                  isActive={consentStatus?.stream === key}
                  onSelect={() => handleStreamSelect(key)}
                />
              ))}
            </div>
          </div>

          {/* Impact dashboard (for PARTNERED/ANONYMOUS users) */}
          {consentStatus && ["partnered", "anonymous"].includes(consentStatus.stream) && (
            <ImpactDashboard consentStatus={consentStatus} />
          )}

          {/* Audit trail */}
          <AuditTrail />

          {/* Privacy notice */}
          <div className="mt-8 text-center text-xs text-gray-500">
            <p>
              You can only view and manage your own consent settings. 
              {user?.role === 'ADMIN' && ' As an admin, you can view (but not modify) consent records for compliance purposes.'}
            </p>
          </div>
        </div>
      </div>

      {/* Partnership Request Modal */}
      <PartnershipModal
        isOpen={showPartnershipModal}
        onClose={() => setShowPartnershipModal(false)}
        onSuccess={handlePartnershipSuccess}
      />
    </ProtectedRoute>
  );
}

// Stream selection card component
function StreamCard({ 
  streamKey, 
  stream, 
  isActive, 
  onSelect 
}: { 
  streamKey: string; 
  stream: ConsentStream; 
  isActive: boolean;
  onSelect: () => void;
}) {
  const getIcon = () => {
    switch (streamKey) {
      case "temporary": return "🛡️";
      case "partnered": return "🤝";
      case "anonymous": return "👤";
      default: return "📋";
    }
  };

  const getBenefits = () => {
    switch (streamKey) {
      case "temporary":
        return ["✓ No tracking", "✓ Auto-forget in 14 days", "✗ No learning"];
      case "partnered":
        return ["✓ Mutual growth", "✓ Personalized experience", "✓ Full features"];
      case "anonymous":
        return ["✓ Help others", "✓ No identity stored", "✓ Statistical contribution"];
      default:
        return [];
    }
  };

  return (
    <div className={`border rounded-lg p-6 ${isActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
      <div className="text-center mb-4">
        <span className="text-4xl">{getIcon()}</span>
        <h3 className="mt-2 text-lg font-semibold capitalize">{stream.name}</h3>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">{stream.description}</p>
      
      <ul className="space-y-1 mb-4">
        {getBenefits().map((benefit, idx) => (
          <li key={idx} className="text-sm">{benefit}</li>
        ))}
      </ul>

      {stream.duration_days && (
        <p className="text-xs text-gray-500 mb-4">Duration: {stream.duration_days} days</p>
      )}

      {stream.requires_categories && (
        <p className="text-xs text-orange-600 mb-4">⚠️ Requires agent approval</p>
      )}

      <button
        onClick={onSelect}
        disabled={isActive}
        className={`w-full py-2 px-4 rounded-md text-sm font-medium ${
          isActive 
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        {isActive ? 'Current Stream' : streamKey === 'partnered' ? 'Request Partnership' : 'Switch Stream'}
      </button>
    </div>
  );
}

// Impact dashboard component
function ImpactDashboard({ consentStatus }: { consentStatus: ConsentStatus }) {
  const [impact, setImpact] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchImpact = async () => {
      try {
        const response = await cirisClient.consent.getImpactReport();
        setImpact(response);
      } catch (error: any) {
        console.error("❌ Failed to fetch impact data:", error);
        console.error("Impact error details:", {
          status: error?.status,
          detail: error?.detail,
          message: error?.message
        });
        // Don't throw here as impact is optional, but log prominently
      } finally {
        setLoading(false);
      }
    };

    fetchImpact();
  }, []);

  if (loading) return <div className="animate-pulse h-32 bg-gray-200 rounded-lg"></div>;
  if (!impact) return null;

  return (
    <div className="mb-8 bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Impact</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-indigo-600">{impact.total_interactions}</div>
          <div className="text-sm text-gray-600">Total Interactions</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600">{impact.patterns_contributed}</div>
          <div className="text-sm text-gray-600">Patterns Contributed</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">{impact.users_helped}</div>
          <div className="text-sm text-gray-600">Users Helped</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-purple-600">{impact.impact_score.toFixed(1)}</div>
          <div className="text-sm text-gray-600">Impact Score</div>
        </div>
      </div>
    </div>
  );
}

// Audit trail component
function AuditTrail() {
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const response = await cirisClient.consent.getAuditTrail(10);
        setAuditEntries(response);
      } catch (error: any) {
        console.error("❌ Failed to fetch audit trail:", error);
        console.error("Audit error details:", {
          status: error?.status,
          detail: error?.detail,
          message: error?.message
        });
        // Don't throw here as audit is optional, but log prominently
      } finally {
        setLoading(false);
      }
    };

    fetchAudit();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Consent History</h2>
      
      {loading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-200 rounded"></div>
          ))}
        </div>
      ) : auditEntries.length === 0 ? (
        <p className="text-gray-500">No consent changes recorded</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Previous</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">New</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Initiated By</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {auditEntries.map((entry) => (
                <tr key={entry.entry_id}>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-sm capitalize">{entry.previous_stream}</td>
                  <td className="px-4 py-2 text-sm capitalize">{entry.new_stream}</td>
                  <td className="px-4 py-2 text-sm">{entry.initiated_by}</td>
                  <td className="px-4 py-2 text-sm text-gray-600">{entry.reason || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Export the page wrapped in error boundary
export default function ConsentPage() {
  return (
    <ConsentErrorBoundary>
      <ConsentPageContent />
    </ConsentErrorBoundary>
  );
}