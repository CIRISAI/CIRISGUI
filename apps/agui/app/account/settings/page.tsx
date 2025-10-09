'use client';

import { useState, useEffect } from 'react';
import { CIRISClient } from '@/lib/ciris-sdk';
import type { UserSettingsResponse, UpdateUserSettingsRequest } from '@/lib/ciris-sdk/resources/users';

export default function UserSettingsPage() {
  const [settings, setSettings] = useState<UserSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [preferredName, setPreferredName] = useState('');
  const [location, setLocation] = useState('');
  const [interactionPreferences, setInteractionPreferences] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const client = new CIRISClient();
      const data = await client.users.getMySettings();
      setSettings(data);

      // Populate form fields
      setPreferredName(data.user_preferred_name || '');
      setLocation(data.location || '');
      setInteractionPreferences(data.interaction_preferences || '');
      setMarketingOptIn(data.marketing_opt_in);
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const client = new CIRISClient();
      const updateData: UpdateUserSettingsRequest = {
        user_preferred_name: preferredName || undefined,
        location: location || undefined,
        interaction_preferences: interactionPreferences || undefined,
        marketing_opt_in: marketingOptIn,
      };

      const updated = await client.users.updateMySettings(updateData);
      setSettings(updated);
      setSuccessMessage('Settings saved successfully');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (settings) {
      setPreferredName(settings.user_preferred_name || '');
      setLocation(settings.location || '');
      setInteractionPreferences(settings.interaction_preferences || '');
      setMarketingOptIn(settings.marketing_opt_in);
      setError(null);
      setSuccessMessage(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12 text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">User Settings</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your personal preferences and interaction settings
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="p-6 space-y-6">
          {/* Preferred Name */}
          <div>
            <label htmlFor="preferredName" className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Name
            </label>
            <input
              id="preferredName"
              type="text"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder="How would you like to be addressed?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              This name will be used when the agent addresses you directly
            </p>
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
              Location
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., San Francisco, CA"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Your location helps provide context-aware responses (timezone, local info, etc.)
            </p>
          </div>

          {/* Interaction Preferences */}
          <div>
            <label htmlFor="interactionPreferences" className="block text-sm font-medium text-gray-700 mb-2">
              Interaction Preferences
            </label>
            <textarea
              id="interactionPreferences"
              value={interactionPreferences}
              onChange={(e) => setInteractionPreferences(e.target.value)}
              placeholder="Describe how you'd like the agent to interact with you (e.g., 'Be concise and technical', 'Use simple language', 'Include examples')"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Provide custom instructions for how the agent should communicate with you
            </p>
          </div>

          {/* Marketing Opt-in */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="marketingOptIn"
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded cursor-pointer"
                />
              </div>
              <div className="ml-3">
                <label htmlFor="marketingOptIn" className="font-medium text-gray-700 cursor-pointer">
                  Marketing Communications
                </label>
                <p className="text-sm text-gray-500 mt-1">
                  Receive updates, news, and marketing materials from CIRIS L3C
                </p>
                {settings?.marketing_opt_in_source && (
                  <p className="text-xs text-gray-400 mt-1">
                    Consent source: {settings.marketing_opt_in_source}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={handleReset}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Information Notice */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">About User Settings</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Settings are stored in the agent's memory graph as part of your user node</li>
          <li>These preferences help personalize your interactions with the agent</li>
          <li>All fields are optional - provide as much or as little information as you like</li>
          <li>You can update these settings at any time</li>
        </ul>
      </div>
    </div>
  );
}
