import { useState } from "react";
import { cirisClient, ConsentStream, ConsentCategory } from "../../lib/ciris-sdk";

interface PartnershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CONSENT_CATEGORIES = [
  {
    id: ConsentCategory.INTERACTION,
    name: "Interaction",
    description: "Learn from our conversations",
    icon: "💬",
  },
  {
    id: ConsentCategory.PREFERENCE,
    name: "Preference",
    description: "Learn your preferences and patterns",
    icon: "⚙️",
  },
  {
    id: ConsentCategory.IMPROVEMENT,
    name: "Improvement",
    description: "Use for self-improvement",
    icon: "📈",
  },
  {
    id: ConsentCategory.RESEARCH,
    name: "Research",
    description: "Use for research purposes",
    icon: "🔬",
  },
  {
    id: ConsentCategory.SHARING,
    name: "Sharing",
    description: "Share learnings with others",
    icon: "🤲",
  },
];

export default function PartnershipModal({ isOpen, onClose, onSuccess }: PartnershipModalProps) {
  const [selectedCategories, setSelectedCategories] = useState<ConsentCategory[]>([]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCategoryToggle = (categoryId: ConsentCategory) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleSubmit = async () => {
    if (selectedCategories.length === 0) {
      setError("Please select at least one category");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Debug logging
      console.log("Selected categories (raw):", selectedCategories);
      console.log("Selected categories (values):", selectedCategories.map(c => String(c)));
      
      await cirisClient.consent.requestPartnership(
        selectedCategories,
        reason || "User requested partnership upgrade"
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      // Better error handling
      const errorMessage = err?.detail || err?.message || "Failed to submit partnership request. Please try again.";
      setError(errorMessage);
      console.error("Partnership request failed:", err);
      console.error("Error details:", {
        status: err?.status,
        detail: err?.detail,
        message: err?.message,
        type: err?.type
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Request Partnership</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Partnership requires mutual consent. The agent will review your request.
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Categories selection */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Select what you'd like to share:
            </h3>
            <div className="space-y-3">
              {CONSENT_CATEGORIES.map(category => (
                <label
                  key={category.id}
                  className="flex items-start cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category.id)}
                    onChange={() => handleCategoryToggle(category.id)}
                    className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center">
                      <span className="text-lg mr-2">{category.icon}</span>
                      <span className="font-medium text-gray-900">{category.name}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Reason field */}
          <div className="mb-6">
            <label htmlFor="reason" className="block text-sm font-medium text-gray-900 mb-2">
              Tell the agent why you want to partner (optional):
            </label>
            <textarea
              id="reason"
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Share your goals and how partnership would help both of us grow..."
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">About Partnership</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>The agent will review your request within 48 hours</li>
                    <li>You'll be notified when a decision is made</li>
                    <li>You can withdraw your request at any time</li>
                    <li>Partnership can be ended by either party</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || selectedCategories.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}