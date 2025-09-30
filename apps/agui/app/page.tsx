'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cirisClient } from '../lib/ciris-sdk';
import { sdkConfigManager } from '../lib/sdk-config-manager';
import toast from 'react-hot-toast';
import { StatusDot } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { useAgent } from '../contexts/AgentContextHybrid';
import { NoAgentsPlaceholder } from '../components/NoAgentsPlaceholder';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { extractErrorMessage, getDiscordInvite } from '../lib/utils/error-helpers';
import { ErrorModal } from '../components/ErrorModal';

export default function InteractPage() {
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

  // Simple reasoning visualization state
  const [reasoningData, setReasoningData] = useState<any[]>([]);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [reasoningRounds, setReasoningRounds] = useState<Map<number, any[]>>(new Map());
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Simple step mapping for 4-step visualization
  const simpleSteps = {
    'DMAS': ['GATHER_CONTEXT', 'PERFORM_DMAS', 'PERFORM_ASPDMA'],
    'ACTION_SELECTION': ['FINALIZE_ACTION'],
    'CONSCIENCE': ['CONSCIENCE_EXECUTION', 'RECURSIVE_CONSCIENCE'],
    'ACTION_COMPLETE': ['PERFORM_ACTION', 'ACTION_COMPLETE', 'ROUND_COMPLETE']
  };

  // Ensure SDK is configured for the current agent
  useEffect(() => {
    if (currentAgent) {
      // Configure SDK for the selected agent
      const selectedAgentId = localStorage.getItem('selectedAgentId') || currentAgent.agent_id;
      sdkConfigManager.configure(selectedAgentId);
    }
  }, [currentAgent]);

  // Connect to reasoning stream for simple visualization
  useEffect(() => {
    const token = cirisClient.auth.getAccessToken();
    if (!token) {
      setStreamError('Authentication required for streaming');
      return;
    }

    // Use SDK's configured base URL to ensure proper routing
    const apiBaseUrl = cirisClient.getBaseURL();
    const streamUrl = `${apiBaseUrl}/v1/system/runtime/reasoning-stream`;

    console.log('🔌 Connecting to reasoning stream:', streamUrl);
    console.log('Token being used:', token.substring(0, 20) + '...');

    // Create abort controller for cleanup
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Use fetch with proper headers instead of EventSource
    const connectStream = async () => {
      try {
        const response = await fetch(streamUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log('✅ Stream response received');
        setStreamConnected(true);
        setStreamError(null);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (!reader) {
          throw new Error('Response body is not readable');
        }

        // Process the stream
        let eventType = '';
        let eventData = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log('Stream ended');
            // Process any remaining buffered event
            if (eventType && eventData) {
              processSSEEvent(eventType, eventData);
            }
            break;
          }

          // Decode and buffer
          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE events
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              // If we have a pending event, process it first
              if (eventType && eventData) {
                processSSEEvent(eventType, eventData);
              }
              eventType = line.slice(6).trim();
              eventData = '';
            } else if (line.startsWith('data:')) {
              // SSE can have multi-line data, append if we already have some
              const newData = line.slice(5).trim();
              eventData = eventData ? eventData + '\n' + newData : newData;
            } else if (line === '') {
              // Empty line signals end of event
              if (eventType && eventData) {
                processSSEEvent(eventType, eventData);
                eventType = '';
                eventData = '';
              }
            }
            // Ignore other lines (comments, etc.)
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('❌ Stream connection error:', error);
          setStreamError(`Connection failed: ${error.message}`);
          setStreamConnected(false);
        }
      }
    };

    // Function to process SSE events
    const processSSEEvent = (eventType: string, eventData: string) => {
      console.log(`🎯 SSE Event received - Type: ${eventType}, Data length: ${eventData.length}`);

      try {
        if (eventType === 'connected') {
          console.log('✅ Stream connected:', eventData);
          setStreamConnected(true);
          setStreamError(null);
        } else if (eventType === 'step_update') {
          const update = JSON.parse(eventData);
          console.log('📊 Step update received:', {
            thoughtCount: update.updated_thoughts?.length || 0,
            sequence: update.stream_sequence,
            updateType: update.update_type,
            currentStep: update.current_step
          });

          // Process the step data for visualization
          if (update.current_step) {
            // Find which simple step this belongs to
            for (const [simpleStep, detailSteps] of Object.entries(simpleSteps)) {
              if (detailSteps.includes(update.current_step)) {
                setActiveStep(simpleStep);
                setTimeout(() => setActiveStep(null), 2000); // Clear after 2 seconds
                break;
              }
            }

            // Group data by rounds
            if (update.round_number !== undefined) {
              setReasoningRounds(prev => {
                const newMap = new Map(prev);
                const roundData = newMap.get(update.round_number) || [];
                roundData.push(update);
                newMap.set(update.round_number, roundData);
                return newMap;
              });
            } else {
              // Add to general reasoning data if no round number
              setReasoningData(prev => [...prev.slice(-20), update]); // Keep last 20
            }
          }

          // Also check thoughts for step updates
          if (update.updated_thoughts && Array.isArray(update.updated_thoughts)) {
            update.updated_thoughts.forEach((thought: any) => {
              if (thought.current_step) {
                // Find which simple step this belongs to
                for (const [simpleStep, detailSteps] of Object.entries(simpleSteps)) {
                  if (detailSteps.includes(thought.current_step)) {
                    setActiveStep(simpleStep);
                    setTimeout(() => setActiveStep(null), 2000);
                    break;
                  }
                }
              }
            });
          }

        } else if (eventType === 'keepalive') {
          console.log('💓 Keepalive:', eventData);
        } else if (eventType === 'error') {
          const errorData = JSON.parse(eventData);
          console.error('❌ Stream error:', errorData);
          setStreamError(`Stream error: ${errorData.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Failed to process event:', eventType, error);
      }
    };

    // Start the connection
    connectStream();

    return () => {
      console.log('🔌 Closing stream connection');
      abortController.abort();
      abortControllerRef.current = null;
    };
  }, [currentAgent]);

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

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Interact with CIRIS</h1>
          <p className="mt-2 text-lg text-gray-600">
            Chat with your CIRIS agent in real-time
          </p>
        </div>

        {/* Show placeholder if no agents */}
        {!isLoadingAgents && !currentAgent && (
          <NoAgentsPlaceholder />
        )}

        {/* Only show chat interface if agent is selected */}
        {currentAgent && (
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
                  <span className={`flex items-center ${streamConnected ? 'text-green-600' : 'text-red-600'}`}>
                    <StatusDot status={streamConnected ? 'green' : 'red'} className="mr-2" />
                    Stream: {streamConnected ? 'Connected' : 'Disconnected'}
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

              {/* Stream Error Display */}
              {streamError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-red-800">Stream Error: {streamError}</p>
                </div>
              )}

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

                      return (
                        <div
                          key={msg.id || idx}
                          className={`flex ${msg.is_agent ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              msg.is_agent
                                ? 'bg-white border border-gray-200'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            <div className={`text-xs mb-1 ${msg.is_agent ? 'text-gray-500' : 'text-blue-100'}`}>
                              {msg.author || (msg.is_agent ? 'CIRIS' : 'You')} • {new Date(msg.timestamp).toLocaleTimeString()}
                            </div>
                            <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
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
            </div>
          </div>
        )}

        {/* Simple Reasoning Visualization */}
        {currentAgent && (
          <div className="mt-6 bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">CIRIS Reasoning Process</h3>

              {/* Simple Circular SVG */}
              <div className="flex justify-center mb-6">
                <svg width="300" height="300" viewBox="0 0 300 300" className="text-gray-600">
                  {/* Background circle */}
                  <circle cx="150" cy="150" r="120" fill="none" stroke="#e5e7eb" strokeWidth="2" />

                  {/* DMAS - Top (12 o'clock) */}
                  <g id="dmas-group">
                    <circle
                      cx="150"
                      cy="30"
                      r="25"
                      fill={activeStep === 'DMAS' ? '#ef4444' : '#f3f4f6'}
                      stroke={activeStep === 'DMAS' ? '#dc2626' : '#9ca3af'}
                      strokeWidth="3"
                      className={activeStep === 'DMAS' ? 'animate-pulse' : ''}
                    />
                    <text x="150" y="37" textAnchor="middle" className="text-sm font-medium fill-current">
                      DMAS
                    </text>
                    <text x="150" y="10" textAnchor="middle" className="text-xs fill-gray-500">
                      Memory & Context
                    </text>
                  </g>

                  {/* ACTION SELECTION - Right (3 o'clock) */}
                  <g id="action-selection-group">
                    <circle
                      cx="270"
                      cy="150"
                      r="25"
                      fill={activeStep === 'ACTION_SELECTION' ? '#ef4444' : '#f3f4f6'}
                      stroke={activeStep === 'ACTION_SELECTION' ? '#dc2626' : '#9ca3af'}
                      strokeWidth="3"
                      className={activeStep === 'ACTION_SELECTION' ? 'animate-pulse' : ''}
                    />
                    <text x="270" y="157" textAnchor="middle" className="text-sm font-medium fill-current">
                      ACTION
                    </text>
                    <text x="270" y="147" textAnchor="middle" className="text-sm font-medium fill-current">
                      SELECT
                    </text>
                    <text x="270" y="190" textAnchor="middle" className="text-xs fill-gray-500">
                      Choose Response
                    </text>
                  </g>

                  {/* CONSCIENCE - Bottom (6 o'clock) */}
                  <g id="conscience-group">
                    <circle
                      cx="150"
                      cy="270"
                      r="25"
                      fill={activeStep === 'CONSCIENCE' ? '#ef4444' : '#f3f4f6'}
                      stroke={activeStep === 'CONSCIENCE' ? '#dc2626' : '#9ca3af'}
                      strokeWidth="3"
                      className={activeStep === 'CONSCIENCE' ? 'animate-pulse' : ''}
                    />
                    <text x="150" y="277" textAnchor="middle" className="text-sm font-medium fill-current">
                      CONSCIENCE
                    </text>
                    <text x="150" y="295" textAnchor="middle" className="text-xs fill-gray-500">
                      Ethical Check
                    </text>
                  </g>

                  {/* ACTION COMPLETE - Left (9 o'clock) */}
                  <g id="action-complete-group">
                    <circle
                      cx="30"
                      cy="150"
                      r="25"
                      fill={activeStep === 'ACTION_COMPLETE' ? '#ef4444' : '#f3f4f6'}
                      stroke={activeStep === 'ACTION_COMPLETE' ? '#dc2626' : '#9ca3af'}
                      strokeWidth="3"
                      className={activeStep === 'ACTION_COMPLETE' ? 'animate-pulse' : ''}
                    />
                    <text x="30" y="157" textAnchor="middle" className="text-sm font-medium fill-current">
                      ACTION
                    </text>
                    <text x="30" y="147" textAnchor="middle" className="text-sm font-medium fill-current">
                      COMPLETE
                    </text>
                    <text x="30" y="125" textAnchor="middle" className="text-xs fill-gray-500">
                      Execute & Finish
                    </text>
                  </g>

                  {/* Flow arrows */}
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7"
                            refX="10" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
                    </marker>
                  </defs>

                  {/* DMAS -> ACTION SELECTION */}
                  <path d="M 175 55 Q 220 80 245 125" fill="none" stroke="#6b7280" strokeWidth="2" markerEnd="url(#arrowhead)" />

                  {/* ACTION SELECTION -> CONSCIENCE */}
                  <path d="M 245 175 Q 220 220 175 245" fill="none" stroke="#6b7280" strokeWidth="2" markerEnd="url(#arrowhead)" />

                  {/* CONSCIENCE -> ACTION COMPLETE */}
                  <path d="M 125 245 Q 80 220 55 175" fill="none" stroke="#6b7280" strokeWidth="2" markerEnd="url(#arrowhead)" />

                  {/* ACTION COMPLETE -> DMAS (completing the circle) */}
                  <path d="M 55 125 Q 80 80 125 55" fill="none" stroke="#6b7280" strokeWidth="2" markerEnd="url(#arrowhead)" />
                </svg>
              </div>

              {/* Active step indicator */}
              {activeStep && (
                <div className="text-center mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    Currently: {activeStep.replace('_', ' ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reasoning Data by Round */}
        {currentAgent && reasoningRounds.size > 0 && (
          <div className="mt-6 bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Reasoning Details by Round ({reasoningRounds.size} rounds)
              </h3>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {Array.from(reasoningRounds.entries())
                  .sort(([a], [b]) => b - a) // Most recent rounds first
                  .slice(0, 5) // Show last 5 rounds
                  .map(([roundNumber, roundData]) => (
                    <details key={roundNumber} className="border border-gray-200 rounded-lg">
                      <summary className="cursor-pointer p-3 bg-gray-50 hover:bg-gray-100 rounded-t-lg">
                        <span className="font-medium">Round {roundNumber}</span>
                        <span className="ml-2 text-sm text-gray-500">
                          ({roundData.length} steps)
                        </span>
                      </summary>
                      <div className="p-3 space-y-2">
                        {roundData.map((step, index) => (
                          <div key={index} className="bg-gray-50 rounded p-2">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {step.step_point}
                              </span>
                              <span className="text-xs text-gray-500">
                                {step.processing_time_ms}ms
                              </span>
                            </div>
                            {step.step_result && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                  Step Data
                                </summary>
                                <pre className="mt-1 p-2 bg-white rounded overflow-x-auto text-xs whitespace-pre-wrap break-words">
                                  {JSON.stringify(step.step_result, null, 2)}
                                </pre>
                              </details>
                            )}
                            {step.transparency_data && (
                              <details className="text-xs mt-1">
                                <summary className="cursor-pointer text-purple-600 hover:text-purple-800">
                                  Transparency Data
                                </summary>
                                <pre className="mt-1 p-2 bg-purple-50 rounded overflow-x-auto text-xs whitespace-pre-wrap break-words">
                                  {JSON.stringify(step.transparency_data, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
              </div>
            </div>
          </div>
        )}

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
    </ProtectedRoute>
  );
}