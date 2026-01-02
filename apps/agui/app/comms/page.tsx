'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cirisClient } from '../../lib/ciris-sdk';
import toast from 'react-hot-toast';
import { StatusDot } from '../../components/Icons';
import { useAuth } from '../../contexts/AuthContext';
import { useAgent } from '../../contexts/AgentContextHybrid';
import { NoAgentsPlaceholder } from '../../components/NoAgentsPlaceholder';
import { extractErrorMessage, getDiscordInvite } from '../../lib/utils/error-helpers';
import { ErrorModal } from '../../components/ErrorModal';
import type { ConversationMessage, MessageType } from '../../lib/ciris-sdk/types';

// Helper to get effective message type (backward compatible with is_agent)
function getEffectiveMessageType(msg: ConversationMessage): MessageType {
  if (msg.message_type) return msg.message_type;
  return msg.is_agent ? 'agent' : 'user';
}

// Helper to get message styles based on type
function getMessageStyles(type: MessageType) {
  switch (type) {
    case 'user':
      return {
        container: 'justify-end',
        bubble: 'bg-blue-600 text-white',
        meta: 'text-blue-100',
        icon: null,
      };
    case 'agent':
      return {
        container: 'justify-start',
        bubble: 'bg-white border border-gray-200',
        meta: 'text-gray-500',
        icon: null,
      };
    case 'system':
      return {
        container: 'justify-center',
        bubble: 'bg-blue-50 border border-blue-200 text-blue-700',
        meta: 'text-blue-500',
        icon: 'info',
      };
    case 'error':
      return {
        container: 'justify-center',
        bubble: 'bg-red-50 border border-red-200 text-red-700',
        meta: 'text-red-500',
        icon: 'warning',
      };
  }
}

// Icon components for system/error messages
function InfoIcon() {
  return (
    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

export default function CommsPage() {
  const { user } = useAuth();
  const { currentAgent, isLoadingAgents } = useAgent();
  const [message, setMessage] = useState('');
  const [showShutdownDialog, setShowShutdownDialog] = useState(false);
  const [showEmergencyShutdownDialog, setShowEmergencyShutdownDialog] = useState(false);
  const [shutdownReason, setShutdownReason] = useState('User requested graceful shutdown');
  const [emergencyReason, setEmergencyReason] = useState('EMERGENCY: Immediate shutdown required');
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string; details?: any }>({
    isOpen: false,
    message: '',
    details: undefined
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch conversation history - limit to 20 most recent
  const { data: history, isLoading } = useQuery({
    queryKey: ['conversation-history'],
    queryFn: async () => {
      const result = await cirisClient.agent.getHistory({
        channel_id: 'api_0.0.0.0_8080',
        limit: 20
      });
      return result;
    },
    refetchInterval: 2000, // Refresh every 2 seconds to catch responses
    enabled: !!currentAgent,
  });

  // Fetch agent status
  const { data: status, isError: statusError } = useQuery({
    queryKey: ['agent-status'],
    queryFn: () => cirisClient.agent.getStatus(),
    refetchInterval: 5000, // Refresh every 5 seconds
    enabled: !!currentAgent,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (msg: string) => {
      const response = await cirisClient.agent.interact(msg, {
        channel_id: 'api_0.0.0.0_8080'
      });
      return response;
    },
    onSuccess: (response) => {
      setMessage('');
      // Immediately refetch history to show the response
      queryClient.invalidateQueries({ queryKey: ['conversation-history'] });

      // Show the agent's response in a toast for visibility
      if (response.response) {
        toast.success(`Agent: ${response.response}`, { duration: 5000 });
      }
    },
    onError: (error: any) => {
      console.error('Send message error:', error);
      
      // Extract error message
      const errorMessage = extractErrorMessage(error);
      
      // Show error modal instead of toast
      setErrorModal({
        isOpen: true,
        message: errorMessage,
        details: error.response?.data || error.details
      });
    },
  });

  // Shutdown mutation
  const shutdownMutation = useMutation({
    mutationFn: async () => {
      return await cirisClient.system.shutdown(shutdownReason, true, false);
    },
    onSuccess: (response) => {
      toast.success(`Shutdown initiated: ${response.message}`, { duration: 10000 });
      setShowShutdownDialog(false);
      // Refresh status to show shutdown state
      queryClient.invalidateQueries({ queryKey: ['agent-status'] });
    },
    onError: (error: any) => {
      console.error('Shutdown error:', error);
      const errorMessage = extractErrorMessage(error);
      toast.error(errorMessage);
    },
  });

  // Emergency shutdown mutation
  const emergencyShutdownMutation = useMutation({
    mutationFn: async () => {
      return await cirisClient.system.shutdown(emergencyReason, true, true); // force=true
    },
    onSuccess: (response) => {
      toast.success(`EMERGENCY SHUTDOWN INITIATED: ${response.message}`, {
        duration: 10000,
        style: {
          background: '#dc2626',
          color: 'white',
        },
      });
      setShowEmergencyShutdownDialog(false);
    },
    onError: (error: any) => {
      console.error('Emergency shutdown error:', error);
      const errorMessage = extractErrorMessage(error);
      toast.error(errorMessage);
    },
  });


  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessage.mutate(message.trim());
    }
  };

  // Get messages and ensure proper order (oldest to newest)
  const messages = useMemo(() => {
    if (!history?.messages) return [];

    // Sort by timestamp (oldest first) and take last 20
    return [...history.messages]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-20);
  }, [history]);

  // Show placeholder if no agents
  if (!isLoadingAgents && !currentAgent) {
    return (
      <div className="max-w-4xl mx-auto">
        <NoAgentsPlaceholder />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Agent Communications
            </h3>
            <div className="flex items-center space-x-4 text-sm">
              <span className={`flex items-center ${!statusError && status ? 'text-green-600' : 'text-red-600'}`}>
                <StatusDot status={!statusError && status ? 'green' : 'red'} className="mr-2" />
                {!statusError && status ? 'Connected' : 'Disconnected'}
              </span>
              {status && (
                <span className="text-gray-600">
                  State: <span className="font-medium">{status.cognitive_state}</span>
                </span>
              )}
              <button
                onClick={() => setShowShutdownDialog(true)}
                className="ml-4 px-3 py-1 text-xs font-medium text-red-600 border border-red-600 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Shutdown
              </button>
              <button
                onClick={() => {
                  // Check if user has permission (ADMIN or higher)
                  if (user?.role === 'OBSERVER') {
                    toast.error('WISE AUTHORITY OR SYSTEM AUTHORITY REQUIRED', {
                      duration: 5000,
                      style: {
                        background: '#dc2626',
                        color: 'white',
                      },
                    });
                  } else {
                    setShowEmergencyShutdownDialog(true);
                  }
                }}
                className="ml-2 px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                EMERGENCY STOP
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="border rounded-lg bg-gray-50 h-96 overflow-y-auto p-4 mb-4">
            {isLoading ? (
              <div className="text-center text-gray-500">Loading conversation...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-500">No messages yet. Start a conversation!</div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, idx) => {
                  // Debug log to see message structure
                  if (idx === 0) console.log('Message structure:', msg);

                  const msgType = getEffectiveMessageType(msg);
                  const styles = getMessageStyles(msgType);

                  // Determine author display
                  const authorDisplay = msg.author || (
                    msgType === 'user' ? 'You' :
                    msgType === 'agent' ? 'CIRIS' :
                    msgType === 'system' ? 'System' :
                    'Error'
                  );

                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex ${styles.container}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${styles.bubble}`}
                      >
                        <div className={`text-xs mb-1 ${styles.meta}`}>
                          {authorDisplay} • {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                        <div className="text-sm whitespace-pre-wrap flex items-start">
                          {styles.icon === 'info' && <InfoIcon />}
                          {styles.icon === 'warning' && <WarningIcon />}
                          <span>{msg.content}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="text-xs text-gray-500 mb-2">
            Showing last 20 messages
          </div>

          {/* Input form */}
          <form onSubmit={handleSubmit} className="flex space-x-3">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={sendMessage.isPending}
              className="flex-1 min-w-0 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={sendMessage.isPending || !message.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendMessage.isPending ? 'Sending...' : 'Send'}
            </button>
          </form>

          {false && (
            <div className="mt-2 text-sm text-orange-600">
              Agent is paused. Messages cannot be sent.
            </div>
          )}
        </div>
      </div>

      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-4 bg-gray-100 rounded text-xs">
          <p>Total messages in history: {history?.total_count || 0}</p>
          <p>Showing: {messages.length} messages</p>
          <p>Channel: api_0.0.0.0_8080</p>
        </div>
      )}

      {/* Shutdown Confirmation Dialog */}
      {showShutdownDialog && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Initiate Graceful Shutdown
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This will initiate a graceful shutdown of the CIRIS agent. The agent will:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 mb-4 space-y-1">
              <li>Transition to SHUTDOWN cognitive state</li>
              <li>Complete any critical tasks</li>
              <li>May send final messages to channels</li>
              <li>Perform clean shutdown procedures</li>
            </ul>
            <div className="mb-4">
              <label htmlFor="shutdown-reason" className="block text-sm font-medium text-gray-700 mb-2">
                Shutdown Reason
              </label>
              <textarea
                id="shutdown-reason"
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={shutdownReason}
                onChange={(e) => setShutdownReason(e.target.value)}
                placeholder="Enter reason for shutdown..."
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowShutdownDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                onClick={() => shutdownMutation.mutate()}
                disabled={shutdownMutation.isPending || !shutdownReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {shutdownMutation.isPending ? 'Initiating...' : 'Confirm Shutdown'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Shutdown Dialog */}
      {showEmergencyShutdownDialog && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full border-4 border-red-600">
            <h3 className="text-lg font-bold text-red-600 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              EMERGENCY SHUTDOWN
            </h3>
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <p className="text-sm font-semibold text-red-800 mb-2">
                ⚠️ WARNING: This will IMMEDIATELY terminate the agent!
              </p>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                <li>NO graceful shutdown procedures</li>
                <li>NO task completion</li>
                <li>NO final messages</li>
                <li>IMMEDIATE process termination</li>
              </ul>
            </div>
            <div className="mb-4">
              <label htmlFor="emergency-reason" className="block text-sm font-medium text-gray-700 mb-2">
                Emergency Reason (Required)
              </label>
              <textarea
                id="emergency-reason"
                rows={2}
                className="block w-full rounded-md border-red-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                placeholder="Describe the emergency..."
              />
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-xs text-yellow-800">
                <strong>Authority Required:</strong> This action requires ADMIN, AUTHORITY, or SYSTEM_ADMIN role.
                Your current role: <span className="font-semibold">{user?.role || 'Unknown'}</span>
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowEmergencyShutdownDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => emergencyShutdownMutation.mutate()}
                disabled={emergencyShutdownMutation.isPending || !emergencyReason.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emergencyShutdownMutation.isPending ? 'TERMINATING...' : 'EXECUTE EMERGENCY STOP'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, message: '', details: undefined })}
        title="Communication Error"
        message={errorModal.message}
        details={errorModal.details}
      />
    </div>
  );
}
