'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  const { user, hasRole } = useAuth();
  const { currentAgent, isLoadingAgents } = useAgent();

  // CSS for task completion animation
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes flowToBottom {
        0% {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
        50% {
          transform: translateY(200px) scale(1.2);
          opacity: 0.8;
        }
        100% {
          transform: translateY(400px) scale(0.8);
          opacity: 0.3;
        }
      }

      .task-completing {
        animation: flowToBottom 2s ease-in-out forwards;
      }

      @keyframes fadeIn {
        0% {
          opacity: 0;
          transform: scale(0.8);
        }
        100% {
          opacity: 1;
          transform: scale(1);
        }
      }

      .animate-fade-in {
        animation: fadeIn 0.5s ease-out forwards;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);
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
  const [conscienceResult, setConscienceResult] = useState<{passed: boolean, reasoning?: string} | null>(null);
  const [taskData, setTaskData] = useState<Map<string, Map<string, any[]>>>(new Map()); // taskId -> thoughtId -> steps
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  // Animation trigger timestamps for debugging
  const [animationTriggers, setAnimationTriggers] = useState<{
    SNAPSHOT_AND_CONTEXT?: string;
    DMA_RESULTS?: string;
    ASPDMA_RESULT?: string;
    CONSCIENCE_RESULT?: string;
    ACTION_RESULT?: string;
  }>({});

  // Task-thought flow visualization state
  const [activeTasks, setActiveTasks] = useState<Map<string, {
    color: string;
    description: string; // Task description from THOUGHT_START
    thoughts: Map<string, {
      currentStep: string;
      completed: boolean;
      stepsReached: Set<string>; // Track all steps this thought has reached
    }>;
    completed: boolean;
  }>>(new Map());

  // Animation state for completed tasks flowing to results
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const [recentlyCompletedTasks, setRecentlyCompletedTasks] = useState<Array<{
    taskId: string;
    color: string;
    completedAt: Date;
  }>>([]);

  // Task color palette
  const taskColors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
    'bg-red-500', 'bg-pink-500', 'bg-indigo-500', 'bg-yellow-500'
  ];
  const taskColorIndex = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Animation collection and queue system
  const eventCollection = useRef<{step: string, timestamp: string, thoughtId?: string}[]>([]);
  const collectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentlyAnimating = useRef(false);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Process collected events into animation sequence
  const processCollectedEvents = useCallback(async () => {
    if (currentlyAnimating.current || eventCollection.current.length === 0) return;

    // console.log(`🎬 COLLECT: Processing ${eventCollection.current.length} collected events`);
    currentlyAnimating.current = true;

    // Group events by thought to show parallel reasoning
    const thoughtGroups = new Map<string, string[]>();
    const eventsToProcess = [...eventCollection.current];
    eventCollection.current = []; // Clear collection

    // Organize steps by thought
    eventsToProcess.forEach(event => {
      const thoughtId = event.thoughtId || 'main';
      if (!thoughtGroups.has(thoughtId)) {
        thoughtGroups.set(thoughtId, []);
      }
      thoughtGroups.get(thoughtId)!.push(event.step);
    });

    // Create sequence: get unique steps in logical H3ERE order
    const stepOrder = ['THOUGHT_START', 'SNAPSHOT_AND_CONTEXT', 'DMA_RESULTS', 'ASPDMA_RESULT', 'CONSCIENCE_RESULT', 'ACTION_RESULT'];
    const uniqueSteps = new Set<string>();

    eventsToProcess.forEach(event => uniqueSteps.add(event.step));
    const orderedSteps = stepOrder.filter(step => uniqueSteps.has(step));

    // console.log(`🎬 COLLECT: Animation sequence: [${orderedSteps.join(' → ')}]`);
    // console.log(`🎬 COLLECT: Thoughts involved: ${Array.from(thoughtGroups.keys()).join(', ')}`);

    // Animate each step in sequence
    for (const step of orderedSteps) {
      const queueTime = new Date().toLocaleTimeString();
      // console.log(`🎬 COLLECT: Setting activeStep to '${step}' at ${queueTime}`);
      setActiveStep(step);

      // Record the animation trigger time
      setAnimationTriggers(prev => ({
        ...prev,
        [step]: queueTime
      }));

      // Wait 800ms before next animation (ensures visibility)
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // console.log(`🎬 COLLECT: Animation sequence complete`);

    // Clear after final step (with delay)
    animationTimeoutRef.current = setTimeout(() => {
      // console.log(`🎬 COLLECT: Clearing activeStep after sequence complete`);
      setActiveStep(null);
      currentlyAnimating.current = false; // Reset flag after clearing
    }, 2000);
  }, []);

  // Collect animation events with delay before processing
  const collectAnimationEvent = useCallback((step: string, thoughtId?: string) => {
    const collectTime = new Date().toLocaleTimeString();

    // BLOCK new events while animation is currently processing
    if (currentlyAnimating.current) {
      // console.log(`🎬 COLLECT: BLOCKING '${step}' - animation already in progress at ${collectTime}`);
      return;
    }

    // console.log(`🎬 COLLECT: Adding '${step}' (thought: ${thoughtId || 'main'}) to collection at ${collectTime}`);

    // Add to collection (allow duplicates from different thoughts)
    eventCollection.current.push({
      step,
      timestamp: collectTime,
      thoughtId
    });

    // Clear any existing collection timeout
    if (collectionTimeoutRef.current) {
      clearTimeout(collectionTimeoutRef.current);
    }

    // Set new collection timeout (150ms to gather burst)
    collectionTimeoutRef.current = setTimeout(() => {
      // console.log(`🎬 COLLECT: Collection timeout reached, processing ${eventCollection.current.length} events`);
      processCollectedEvents();
    }, 150);

    // console.log(`🎬 COLLECT: Collection now has ${eventCollection.current.length} events, waiting 150ms for more...`);
  }, [processCollectedEvents]);

  // Update task-thought flow visualization
  const updateTaskThoughtFlow = useCallback((thoughtId: string, taskId: string, step: string, stepResult?: any, taskDescription?: string) => {
    setActiveTasks(prev => {
      const newTasks = new Map(prev);

      // Get or create task
      let task = newTasks.get(taskId);
      if (!task) {
        // Assign new color to new task
        const color = taskColors[taskColorIndex.current % taskColors.length];
        taskColorIndex.current++;

        task = {
          color,
          description: taskDescription || '',
          thoughts: new Map(),
          completed: false
        };
        newTasks.set(taskId, task);
        console.log(`🎨 FLOW: New task ${taskId} assigned color ${color}`);
      } else if (taskDescription && !task.description) {
        // Update description if we didn't have one before
        task.description = taskDescription;
      }

      // Update thought progress
      // Check if task is actually completed by looking at action_executed field
      const actionExecuted = stepResult?.action_executed;
      const isCompleted = actionExecuted === 'task_complete' || actionExecuted === 'task_reject';

      // Map step to lane name for tracking
      const getLaneName = (stepName: string) => {
        const lower = stepName.toLowerCase();
        if (['start_round', 'gather_context', 'perform_dmas', 'snapshot_and_context'].some(s => lower.includes(s))) {
          return 'SNAPSHOT_AND_CONTEXT';
        }
        if (['perform_aspdma', 'recursive_aspdma', 'dma_results'].some(s => lower.includes(s))) {
          return 'DMA_RESULTS';
        }
        if (['conscience_execution', 'recursive_conscience', 'aspdma_result'].some(s => lower.includes(s))) {
          return 'ASPDMA_RESULT';
        }
        if (['finalize_action', 'conscience_result'].some(s => lower.includes(s))) {
          return 'CONSCIENCE_RESULT';
        }
        if (['perform_action', 'action_complete', 'round_complete', 'action_result'].some(s => lower.includes(s))) {
          return 'ACTION_RESULT';
        }
        return null;
      };

      const laneName = getLaneName(step);

      // Get or create thought tracking
      const existingThought = task.thoughts.get(thoughtId);
      const stepsReached = existingThought?.stepsReached || new Set<string>();

      // Add current lane to steps reached
      if (laneName) {
        stepsReached.add(laneName);
      }

      task.thoughts.set(thoughtId, {
        currentStep: step,
        completed: isCompleted,
        stepsReached
      });

      // Check if task is complete
      if (isCompleted) {
        task.completed = true;
        console.log(`🎨 FLOW: Task ${taskId} marked as completed`);

        // Trigger completion animation
        setCompletingTasks(prev => new Set([...prev, taskId]));

        // Add to recently completed tasks for display in results
        setRecentlyCompletedTasks(prev => [
          ...prev,
          {
            taskId,
            color: task!.color, // Safe: task is guaranteed to exist here
            completedAt: new Date()
          }
        ]);

        // Remove from completing animation after delay
        setTimeout(() => {
          setCompletingTasks(prev => {
            const newSet = new Set(prev);
            newSet.delete(taskId);
            return newSet;
          });
        }, 2000); // 2 second animation duration
      }

      // console.log(`🎨 FLOW: Updated task ${taskId}, thought ${thoughtId} → ${step}`);
      // console.log(`🎨 FLOW: Total active tasks: ${newTasks.size}, Task colors:`, Array.from(newTasks.values()).map(t => t.color));
      return newTasks;
    });
  }, [taskColors]);

  // Generate progress bars - one bar per thought that has reached this step
  const generateProgressBars = useCallback((stepName: string) => {
    const bars: React.ReactElement[] = [];

    // Show one bar per thought that has reached this step
    Array.from(activeTasks.entries()).forEach(([taskId, task]) => {
      // Skip completed tasks - they shouldn't show progress bars anymore
      if (task.completed) {
        return;
      }

      // For each thought in this task, check if it has reached this step
      Array.from(task.thoughts.entries()).forEach(([thoughtId, thought]) => {
        // Check if this thought has reached this step
        if (thought.stepsReached.has(stepName)) {
          // Check if this thought is currently at this step
          const isCurrentlyAtThisStep = thought.currentStep.toLowerCase().includes(stepName.toLowerCase());

          bars.push(
            <div
              key={`${taskId}-${thoughtId}-${stepName}`}
              className={`w-4 h-4 rounded-full transition-all duration-300 ${task.color} ${
                isCurrentlyAtThisStep ? 'animate-pulse ring-2 ring-white' : 'opacity-90'
              }`}
              title={`Task ${taskId.substring(0, 8)} - Thought ${thoughtId.substring(0, 8)}`}
            />
          );
        }
      });
    });

    // Add empty indicators to show capacity
    while (bars.length < 4) {
      bars.push(
        <div
          key={`empty-${bars.length}`}
          className="w-4 h-4 rounded-full bg-gray-200"
        />
      );
    }

    return bars.slice(0, 12); // Max 12 indicators to show multiple thoughts
  }, [activeTasks]);

  // Helper to get step index for ordering
  const getStepIndex = (stepName: string): number => {
    const stepLower = stepName.toLowerCase();
    if (['start_round', 'gather_context', 'perform_dmas', 'snapshot_and_context'].some(s => stepLower.includes(s))) return 0;
    if (['perform_aspdma', 'recursive_aspdma', 'dma_results'].some(s => stepLower.includes(s))) return 1;
    if (['conscience_execution', 'recursive_conscience', 'aspdma_result'].some(s => stepLower.includes(s))) return 2;
    if (['finalize_action', 'conscience_result'].some(s => stepLower.includes(s))) return 3;
    if (['perform_action', 'action_complete', 'action_result'].some(s => stepLower.includes(s))) return 4;
    return -1;
  };

  // Track when activeStep state actually changes (React render timing)
  // useEffect(() => {
  //   const renderTime = new Date().toLocaleTimeString();
  //   console.log(`🕐 TIMING: React RENDER: activeStep changed to '${activeStep}' at ${renderTime}`);
  // }, [activeStep]);

  // Corrected step mapping for 4-step visualization (using lowercase to match API)
  const simpleSteps = {
    'DMAS': ['gather_context', 'perform_dmas'],
    'ACTION_SELECTION': ['perform_aspdma', 'recursive_aspdma'],
    'CONSCIENCE': ['conscience_execution', 'recursive_conscience', 'finalize_action'],
    'ACTION_COMPLETE': ['perform_action', 'action_complete', 'round_complete']
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

    // Reconnection state
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;

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
        reconnectAttempts = 0; // Reset on successful connection

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
            console.log('Stream ended - attempting reconnect');
            // Process any remaining buffered event
            if (eventType && eventData) {
              processSSEEvent(eventType, eventData);
            }

            // Stream ended, trigger reconnection
            setStreamConnected(false);
            if (!abortController.signal.aborted) {
              scheduleReconnect();
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

          // Schedule reconnection
          if (!abortController.signal.aborted) {
            scheduleReconnect();
          }
        }
      }
    };

    // Schedule reconnection with exponential backoff
    const scheduleReconnect = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached');
        setStreamError('Connection lost - max reconnection attempts reached');
        return;
      }

      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000); // Max 30s
      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);

      reconnectTimeoutId = setTimeout(() => {
        console.log('🔄 Attempting to reconnect...');
        connectStream();
      }, delay);
    };

    // Function to process SSE events
    const processSSEEvent = (eventType: string, eventData: string) => {
      const wsReceiveTime = new Date().toLocaleTimeString();
      console.log(`🕐 TIMING: WebSocket Event received at ${wsReceiveTime} - Type: ${eventType}, Data length: ${eventData.length}`);

      try {
        if (eventType === 'connected') {
          console.log('✅ Stream connected:', eventData);
          setStreamConnected(true);
          setStreamError(null);
        } else if (eventType === 'thought_start') {
          // New THOUGHT_START event - contains thought + task metadata
          const thoughtStart = JSON.parse(eventData);
          console.log('🎬 THOUGHT_START received:', thoughtStart);

          const thoughtId = thoughtStart.thought_id;
          const taskId = thoughtStart.task_id;
          const taskDescription = thoughtStart.task_description;

          if (thoughtId && taskId) {
            // Initialize task with description
            updateTaskThoughtFlow(thoughtId, taskId, 'thought_start', null, taskDescription);

            // Trigger THOUGHT_START animation
            collectAnimationEvent('THOUGHT_START', thoughtId);
          }
        } else if (eventType === 'step_update') {
          const parseStartTime = new Date().toLocaleTimeString();
          const update = JSON.parse(eventData);
          const parseEndTime = new Date().toLocaleTimeString();

          // Minimal logging - only log errors
          // console.log(`🕐 TIMING: Step update parsing: Start ${parseStartTime} → End ${parseEndTime}`);
          // console.log('📊 Step update received:', update.updated_thoughts?.length || 0, 'thoughts');

          // Process the step data for visualization - handle multiple thoughts
          if (update.updated_thoughts && update.updated_thoughts.length > 0) {
            const animationStartTime = new Date().toLocaleTimeString();
            // console.log(`🕐 TIMING: Animation processing START: ${update.updated_thoughts.length} thoughts at ${animationStartTime}`);
            // console.log(`🕐 TIMING: Timeline: WebSocket(${wsReceiveTime}) → Parse(${parseStartTime}) → Animation(${animationStartTime})`);

            // Process each thought
            update.updated_thoughts.forEach((thought: any, thoughtIndex: number) => {
              const stepToProcess = thought.current_step;
              const thoughtId = thought.thought_id;
              const taskId = thought.task_id;

              if (stepToProcess && thoughtId && taskId) {
                // console.log(`🕐 TIMING: Processing thought ${thoughtIndex}: ${stepToProcess} (ID: ${thoughtId}, Task: ${taskId})`);

                // Update task-thought flow visualization
                // console.log(`🎨 STREAM: Calling updateTaskThoughtFlow(${thoughtId}, ${taskId}, ${stepToProcess})`);
                updateTaskThoughtFlow(thoughtId, taskId, stepToProcess, thought.step_result);

                // Determine which reasoning lane should be lit based on the step (supports old + new names)
                let newActiveStep: string | null = null;

                // Lane 1: SNAPSHOT_AND_CONTEXT (Gather + Context)
                if (['start_round', 'gather_context', 'perform_dmas', 'snapshot_and_context'].includes(stepToProcess)) {
                  newActiveStep = 'SNAPSHOT_AND_CONTEXT';

                // Lane 2: DMA_RESULTS (Analyze situation)
                } else if (['perform_aspdma', 'recursive_aspdma', 'dma_results'].includes(stepToProcess)) {
                  newActiveStep = 'DMA_RESULTS';

                // Lane 3: ASPDMA_RESULT (Action selection)
                } else if (['conscience_execution', 'recursive_conscience', 'aspdma_result'].includes(stepToProcess)) {
                  newActiveStep = 'ASPDMA_RESULT';

                // Lane 4: CONSCIENCE_RESULT (Ethical check)
                } else if (['finalize_action', 'conscience_result'].includes(stepToProcess)) {
                  newActiveStep = 'CONSCIENCE_RESULT';

                // Lane 5: ACTION_RESULT (Execute action)
                } else if (['perform_action', 'action_complete', 'round_complete', 'action_result'].includes(stepToProcess)) {
                  newActiveStep = 'ACTION_RESULT';
                }

                if (newActiveStep) {
                  const setStateTime = new Date().toLocaleTimeString();
                  // console.log(`🕐 TIMING: Collecting animation step: ${newActiveStep} (from ${stepToProcess}, thought: ${thoughtId}) at ${setStateTime}`);

                  // Use collection system to group events before animation
                  collectAnimationEvent(newActiveStep, thoughtId);

                  // console.log(`🕐 TIMING: Animation processing COMPLETE: ${stepToProcess} → ${newActiveStep} at ${new Date().toLocaleTimeString()}`);
                } else {
                  // console.log(`❓ No animation mapping for step: ${stepToProcess} at ${animationStartTime}`);
                }
              }
            });
          } else {
            console.log('❌ No updated_thoughts found in update');
          }

          // Group data by taskId -> thoughtId -> steps
          if (update.updated_thoughts && update.updated_thoughts.length > 0) {
            const thought = update.updated_thoughts[0];
            const taskId = thought.task_id;
            const thoughtId = thought.thought_id;
            const currentStep = thought.current_step;
            const processingTime = thought.step_result?.processing_time_ms || thought.processing_time_ms || 0;

            // console.log(`📊 Adding step to task ${taskId}, thought ${thoughtId}: ${currentStep} (${processingTime}ms)`);

            setTaskData(prev => {
              const newMap = new Map(prev);

              // Get or create task entry
              let taskMap = newMap.get(taskId);
              if (!taskMap) {
                taskMap = new Map();
                newMap.set(taskId, taskMap);
              }

              // Get or create thought entry
              let thoughtSteps = taskMap.get(thoughtId);
              if (!thoughtSteps) {
                thoughtSteps = [];
                taskMap.set(thoughtId, thoughtSteps);
              }

              // Add step data - capture all the step information
              thoughtSteps.push({
                step: currentStep,
                processingTime: processingTime,
                timestamp: thought.current_step_started_at || update.timestamp,
                stepResult: {
                  step_point: currentStep,
                  success: thought.success,
                  timestamp: thought.timestamp || thought.current_step_started_at || update.timestamp,
                  processing_time_ms: processingTime,
                  context: thought.context,
                  summary: thought.summary,
                  action_result: thought.action_result,
                  selected_action: thought.selected_action,
                  action_parameters: thought.action_parameters,
                  context_size: thought.context_size,
                  thoughts_processed: thought.thoughts_processed,
                  round_status: thought.round_status,
                  conscience_passed: thought.conscience_passed,
                  dma_results: thought.dma_results,
                  selection_reasoning: thought.selection_reasoning,
                  dispatch_context: thought.dispatch_context,
                  ...thought.step_result // Include any additional step_result data
                },
                status: thought.status
              });

              // Check for conscience results
              if (currentStep === 'conscience_execution' || currentStep === 'finalize_action') {
                if (thought.conscience_passed !== undefined || thought.selection_reasoning) {
                  console.log(`🎯 Conscience result detected: passed=${thought.conscience_passed}, reasoning available=${!!thought.selection_reasoning}`);
                  setConscienceResult({
                    passed: thought.conscience_passed === true,
                    reasoning: thought.selection_reasoning
                  });

                  // Clear conscience result after 5 seconds
                  setTimeout(() => {
                    setConscienceResult(null);
                  }, 5000);
                }
              }

              console.log(`📊 Task ${taskId} now has ${taskMap.size} thoughts, thought ${thoughtId} has ${thoughtSteps.length} steps`);
              return newMap;
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

      // Clear reconnection timeout if exists
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
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
        <div className="mb-6">
          <p className="text-sm text-gray-600">
            Ask {currentAgent?.agent_name || 'Datum'} a question about CIRIS or an ethical dilemma, and see the reasoning below. Note the agent may choose not to answer.
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
                  {hasRole('ADMIN') && (
                    <button
                      onClick={() => setShowShutdownDialog(true)}
                      className="ml-4 px-3 py-1 text-xs font-medium text-red-600 border border-red-600 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      Shutdown
                    </button>
                  )}
                  {hasRole('AUTHORITY') && (
                    <button
                      onClick={() => setShowEmergencyShutdownDialog(true)}
                      className="ml-2 px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                      EMERGENCY STOP
                    </button>
                  )}
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
              {/* Active Tasks Row - Below text entry */}
              {activeTasks.size > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-center space-x-3 mb-4">
                    {Array.from(activeTasks.entries())
                      .filter(([taskId, task]) => !task.completed)
                      .map(([taskId, task]) => {
                        const isCompleting = completingTasks.has(taskId);
                        const shortDesc = task.description?.substring(0, 20) || '';
                        const last4 = taskId.slice(-4);
                        const displayText = shortDesc ? `${shortDesc}:${last4}` : taskId.split('-').pop()?.substring(0, 6) || taskId.substring(0, 6);
                        return (
                          <div key={taskId} className="flex flex-col items-center">
                            <div
                              className={`px-3 py-2 rounded-lg text-sm font-medium text-white ${task.color} ${
                                isCompleting ? 'task-completing' : 'shadow-md'
                              }`}
                              title={task.description || `Task ${taskId} - ${task.thoughts.size} thoughts`}
                            >
                              {displayText}
                            </div>
                            {/* Thought beams container */}
                            <div className="flex space-x-0.5 mt-2">
                              {Array.from(task.thoughts.entries()).map(([thoughtId, thought], thoughtIndex) => {
                                const totalThoughts = task.thoughts.size;
                                const beamWidth = totalThoughts === 1 ? 'w-8' : totalThoughts === 2 ? 'w-4' : totalThoughts === 3 ? 'w-3' : 'w-2';
                                const isLatest = thoughtIndex === totalThoughts - 1;
                                return (
                                  <div
                                    key={thoughtId}
                                    className={`${beamWidth} h-4 ${task.color} rounded-t transition-all duration-500 ${
                                      isLatest ? 'opacity-100' : 'opacity-40 scale-90'
                                    }`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Debug Info */}
              <div className="text-xs text-gray-500 mb-4">
                Active Tasks Count: {activeTasks.size} |
                Task Colors: {Array.from(activeTasks.values()).map(t => t.color).join(', ')}
              </div>

              {/* Reasoning Lanes - Vertical Beam Flow */}
              <div className="mb-6 relative">
                {/* Task beams flowing through steps - absolutely positioned overlay */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 flex space-x-8 pointer-events-none z-10">
                  {Array.from(activeTasks.entries())
                    .filter(([taskId, task]) => !task.completed)
                    .map(([taskId, task]) => (
                      <div key={taskId} className="flex flex-col items-center">
                        {/* Continuous vertical beam for each thought */}
                        <div className="flex space-x-0.5">
                          {Array.from(task.thoughts.entries()).map(([thoughtId, thought], thoughtIndex) => {
                            const totalThoughts = task.thoughts.size;
                            const beamWidth = totalThoughts === 1 ? 'w-8' : totalThoughts === 2 ? 'w-4' : totalThoughts === 3 ? 'w-3' : 'w-2';
                            const isLatest = thoughtIndex === totalThoughts - 1;

                            // Calculate how far the beam should extend based on steps reached
                            const stepNames = ['SNAPSHOT_AND_CONTEXT', 'DMA_RESULTS', 'ASPDMA_RESULT', 'CONSCIENCE_RESULT', 'ACTION_RESULT'];
                            let maxStepReached = -1;
                            stepNames.forEach((step, idx) => {
                              if (thought.stepsReached.has(step)) {
                                maxStepReached = idx;
                              }
                            });

                            // Height grows as we progress through steps
                            // Each lane is ~5.5rem (p-4 + content) + 0.75rem gap (space-y-3)
                            const beamHeight = maxStepReached >= 0 ? `${(maxStepReached + 1) * 6.25}` : '0';

                            return (
                              <div
                                key={thoughtId}
                                className={`${beamWidth} ${task.color} transition-all duration-500 rounded-b ${
                                  isLatest ? 'opacity-90' : 'opacity-30 scale-90'
                                }`}
                                style={{ height: `${beamHeight}rem` }}
                                title={`Thought ${thoughtId.substring(0, 8)} - Step ${maxStepReached + 1}/5`}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>

                <div className="space-y-3">
                  {/* Lane 1: SNAPSHOT_AND_CONTEXT */}
                  <div className={`flex items-center p-4 rounded-lg border-2 transition-all duration-300 ${
                    activeStep === 'SNAPSHOT_AND_CONTEXT'
                      ? 'border-blue-500 bg-blue-50 shadow-lg'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                      activeStep === 'SNAPSHOT_AND_CONTEXT'
                        ? 'bg-blue-500 text-white animate-pulse'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      📸
                    </div>
                    <div className="ml-4 flex-1">
                      <h4 className="font-medium text-gray-900">SNAPSHOT & CONTEXT</h4>
                      <p className="text-sm text-gray-600">Gather system state and context</p>
                    </div>
                  </div>

                  {/* Lane 2: DMA_RESULTS */}
                  <div className={`flex items-center p-4 rounded-lg border-2 transition-all duration-300 ${
                    activeStep === 'DMA_RESULTS'
                      ? 'border-purple-500 bg-purple-50 shadow-lg'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                      activeStep === 'DMA_RESULTS'
                        ? 'bg-purple-500 text-white animate-pulse'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      🧠
                    </div>
                    <div className="ml-4 flex-1">
                      <h4 className="font-medium text-gray-900">DMA ANALYSIS</h4>
                      <p className="text-sm text-gray-600">Analyze situation with CSDMA, DSDMA, ASPDMA</p>
                    </div>
                  </div>

                  {/* Lane 3: ASPDMA_RESULT */}
                  <div className={`flex items-center p-4 rounded-lg border-2 transition-all duration-300 ${
                    activeStep === 'ASPDMA_RESULT'
                      ? 'border-orange-500 bg-orange-50 shadow-lg'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                      activeStep === 'ASPDMA_RESULT'
                        ? 'bg-orange-500 text-white animate-pulse'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      🎯
                    </div>
                    <div className="ml-4 flex-1">
                      <h4 className="font-medium text-gray-900">ACTION SELECTION</h4>
                      <p className="text-sm text-gray-600">Choose optimal action with rationale</p>
                    </div>
                  </div>

                  {/* Lane 4: CONSCIENCE_RESULT */}
                  <div className={`flex items-center p-4 rounded-lg border-2 transition-all duration-300 ${
                    activeStep === 'CONSCIENCE_RESULT'
                      ? 'border-green-500 bg-green-50 shadow-lg'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                      activeStep === 'CONSCIENCE_RESULT'
                        ? 'bg-green-500 text-white animate-pulse'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      💭
                    </div>
                    <div className="ml-4 flex-1">
                      <h4 className="font-medium text-gray-900">CONSCIENCE CHECK</h4>
                      <p className="text-sm text-gray-600">Ethical evaluation and final decision</p>
                    </div>
                    {/* Conscience Result Indicator */}
                    {conscienceResult && activeStep === 'CONSCIENCE_RESULT' && (
                      <div className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                        conscienceResult.passed
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {conscienceResult.passed ? '✅ APPROVED' : '⚠️ FLAGGED'}
                      </div>
                    )}
                  </div>

                  {/* Lane 5: ACTION_RESULT */}
                  <div className={`flex items-center p-4 rounded-lg border-2 transition-all duration-300 ${
                    activeStep === 'ACTION_RESULT'
                      ? 'border-red-500 bg-red-50 shadow-lg'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                      activeStep === 'ACTION_RESULT'
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      ⚡
                    </div>
                    <div className="ml-4 flex-1">
                      <h4 className="font-medium text-gray-900">ACTION EXECUTION</h4>
                      <p className="text-sm text-gray-600">Perform action and generate audit trail</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active step indicator */}
              <div className="text-center mb-4">
                {activeStep ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    Currently: {activeStep.replace('_', ' ')}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600">
                    Waiting for reasoning steps...
                  </span>
                )}
                {/* Debug info */}
                <div className="text-xs text-gray-500 mt-2">
                  Stream: {streamConnected ? 'Connected' : 'Disconnected'} |
                  Tasks: {taskData.size} |
                  Data: {reasoningData.length} |
                  Active: {activeStep || 'none'}
                </div>
              </div>

              {/* Conscience Result Display */}
              {conscienceResult && conscienceResult.reasoning && (
                <div className={`mt-4 p-4 rounded-lg border-2 ${conscienceResult.passed ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div className="flex items-center mb-2">
                    <span className={`text-lg mr-2 ${conscienceResult.passed ? 'text-green-600' : 'text-yellow-600'}`}>
                      {conscienceResult.passed ? '✅' : '⚠️'}
                    </span>
                    <h4 className={`font-medium ${conscienceResult.passed ? 'text-green-800' : 'text-yellow-800'}`}>
                      Conscience Decision: {conscienceResult.passed ? 'APPROVED' : 'FLAGGED'}
                    </h4>
                  </div>
                  <div className={`text-sm ${conscienceResult.passed ? 'text-green-700' : 'text-yellow-700'}`}>
                    <strong>Reasoning:</strong> {conscienceResult.reasoning}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recently Completed Tasks Banner */}
        {recentlyCompletedTasks.length > 0 && (
          <div className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 shadow rounded-lg">
            <div className="px-4 py-3">
              <div className="flex items-center">
                <h3 className="text-md font-medium text-green-800 mr-4">
                  Recently Completed Tasks:
                </h3>
                <div className="flex space-x-2 overflow-x-auto">
                  {recentlyCompletedTasks.slice(-10).map((completedTask, index) => (
                    <div
                      key={`${completedTask.taskId}-${index}`}
                      className={`px-2 py-1 rounded text-xs font-medium text-white ${completedTask.color} shrink-0 animate-fade-in`}
                      title={`Task ${completedTask.taskId} completed at ${completedTask.completedAt.toLocaleTimeString()}`}
                    >
                      ✓ {completedTask.taskId.split('-').pop()?.substring(0, 6) || completedTask.taskId.substring(0, 6)}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setRecentlyCompletedTasks([])}
                  className="ml-auto text-xs text-gray-500 hover:text-gray-700"
                  title="Clear completed tasks"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reasoning Data by Task/Thought Hierarchy */}
        {currentAgent && taskData.size > 0 && (
          <div className="mt-6 bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Reasoning Details by Task ({taskData.size} tasks)
              </h3>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {Array.from(taskData.entries())
                  .slice(-5) // Show last 5 tasks
                  .map(([taskId, thoughts]) => {
                    // Get task color from activeTasks
                    const task = activeTasks.get(taskId);
                    const taskColor = task?.color || 'bg-blue-500';

                    // Map bg color to lighter version for background
                    const bgColorMap: Record<string, string> = {
                      'bg-blue-500': 'bg-blue-50',
                      'bg-green-500': 'bg-green-50',
                      'bg-purple-500': 'bg-purple-50',
                      'bg-orange-500': 'bg-orange-50',
                      'bg-red-500': 'bg-red-50',
                      'bg-pink-500': 'bg-pink-50',
                      'bg-indigo-500': 'bg-indigo-50',
                      'bg-yellow-500': 'bg-yellow-50',
                    };

                    const hoverColorMap: Record<string, string> = {
                      'bg-blue-500': 'hover:bg-blue-100',
                      'bg-green-500': 'hover:bg-green-100',
                      'bg-purple-500': 'hover:bg-purple-100',
                      'bg-orange-500': 'hover:bg-orange-100',
                      'bg-red-500': 'hover:bg-red-100',
                      'bg-pink-500': 'hover:bg-pink-100',
                      'bg-indigo-500': 'hover:bg-indigo-100',
                      'bg-yellow-500': 'hover:bg-yellow-100',
                    };

                    const textColorMap: Record<string, string> = {
                      'bg-blue-500': 'text-blue-900',
                      'bg-green-500': 'text-green-900',
                      'bg-purple-500': 'text-purple-900',
                      'bg-orange-500': 'text-orange-900',
                      'bg-red-500': 'text-red-900',
                      'bg-pink-500': 'text-pink-900',
                      'bg-indigo-500': 'text-indigo-900',
                      'bg-yellow-500': 'text-yellow-900',
                    };

                    const subtextColorMap: Record<string, string> = {
                      'bg-blue-500': 'text-blue-600',
                      'bg-green-500': 'text-green-600',
                      'bg-purple-500': 'text-purple-600',
                      'bg-orange-500': 'text-orange-600',
                      'bg-red-500': 'text-red-600',
                      'bg-pink-500': 'text-pink-600',
                      'bg-indigo-500': 'text-indigo-600',
                      'bg-yellow-500': 'text-yellow-600',
                    };

                    const bgColor = bgColorMap[taskColor] || 'bg-blue-50';
                    const hoverColor = hoverColorMap[taskColor] || 'hover:bg-blue-100';
                    const textColor = textColorMap[taskColor] || 'text-blue-900';
                    const subtextColor = subtextColorMap[taskColor] || 'text-blue-600';

                    return (
                      <details key={taskId} className="border border-gray-200 rounded-lg">
                        <summary className={`cursor-pointer p-3 ${bgColor} ${hoverColor} rounded-t-lg`}>
                          <span className={`font-medium ${textColor}`}>Task: {taskId}</span>
                          <span className={`ml-2 text-sm ${subtextColor}`}>
                            ({thoughts.size} thoughts)
                          </span>
                        </summary>
                      <div className="p-3 space-y-3">
                        {Array.from(thoughts.entries()).map(([thoughtId, steps]) => (
                          <details key={thoughtId} className="border border-gray-100 rounded-md">
                            <summary className="cursor-pointer p-2 bg-gray-50 hover:bg-gray-100 rounded-t-md">
                              <span className="font-medium text-gray-700">Thought: {thoughtId}</span>
                              <span className="ml-2 text-sm text-gray-500">
                                ({steps.length} steps)
                              </span>
                            </summary>
                            <div className="p-2 space-y-2">
                              {steps.map((step, index) => {
                                const stepData = step.stepResult || {};
                                const stepPoint = stepData.step_point || step.step || 'unknown_step';
                                const success = stepData.success;
                                const processingTime = stepData.processing_time_ms || step.processingTime || 0;
                                const timestamp = stepData.timestamp || step.timestamp;

                                // Status icon based on success
                                const statusIcon = success === true ? '✅' : success === false ? '❌' : '🔄';
                                const statusText = success === true ? 'Success' : success === false ? 'Failed' : 'Processing';
                                const statusColor = success === true ? 'text-green-600' : success === false ? 'text-red-600' : 'text-blue-600';

                                // Determine which animation phase this step belongs to
                                let animationPhase = null;
                                if (['start_round', 'gather_context', 'perform_dmas'].includes(stepPoint)) {
                                  animationPhase = 'DMAS';
                                } else if (['perform_aspdma', 'recursive_aspdma'].includes(stepPoint)) {
                                  animationPhase = 'ACTION_SELECTION';
                                } else if (['conscience_execution', 'recursive_conscience'].includes(stepPoint)) {
                                  animationPhase = 'CONSCIENCE';
                                } else if (['finalize_action', 'perform_action', 'action_complete', 'round_complete'].includes(stepPoint)) {
                                  animationPhase = 'ACTION_COMPLETE';
                                }
                                const animationTriggerTime = animationPhase ? animationTriggers[animationPhase as keyof typeof animationTriggers] : null;

                                return (
                                  <div key={index} className="bg-white border rounded p-2">
                                    <div className="flex justify-between items-start mb-2">
                                      <span className="text-sm font-medium text-gray-900">
                                        {stepPoint.replace('_', ' ').toUpperCase()}
                                      </span>
                                      <div className="flex items-center space-x-2 text-xs">
                                        <span className="font-medium text-gray-600">{processingTime}ms</span>
                                        <span className={`flex items-center space-x-1 ${statusColor}`}>
                                          <span>{statusIcon}</span>
                                          <span className="hidden sm:inline">{statusText}</span>
                                        </span>
                                        <div className="text-gray-400 text-right">
                                          <div>Data: {timestamp ? new Date(timestamp).toLocaleTimeString() : 'N/A'}</div>
                                          {animationTriggerTime && (
                                            <div className={`text-${animationPhase === activeStep ? 'blue' : 'purple'}-600 font-medium`}>
                                              Anim: {animationTriggerTime}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Format key data fields nicely */}
                                    {stepData.summary && (
                                      <div className="mb-2 p-2 bg-blue-50 rounded text-xs">
                                        <div className="font-medium text-blue-800 mb-1">Summary</div>
                                        <div className="text-blue-700 break-words">
                                          {stepData.summary.length > 200
                                            ? `${stepData.summary.substring(0, 200)}...`
                                            : stepData.summary}
                                        </div>
                                      </div>
                                    )}

                                    {stepData.context && (
                                      <details className="text-xs mb-2">
                                        <summary className="cursor-pointer text-green-600 hover:text-green-800 font-medium">
                                          Context Data ({typeof stepData.context === 'string' ? stepData.context.length : 'object'} {typeof stepData.context === 'string' ? 'chars' : 'properties'})
                                        </summary>
                                        <div className="mt-1 p-2 bg-green-50 rounded text-green-700">
                                          {typeof stepData.context === 'string' ? (
                                            <div className="space-y-2">
                                              <div className="text-xs text-green-600 mb-2">String content preview:</div>
                                              <div className="max-h-32 overflow-y-auto bg-white p-2 rounded border text-xs font-mono break-all">
                                                {stepData.context.substring(0, 1000)}
                                                {stepData.context.length > 1000 && '...'}
                                              </div>
                                              <details className="mt-2">
                                                <summary className="cursor-pointer text-green-600 hover:text-green-800 text-xs">
                                                  View Full String ({stepData.context.length} chars)
                                                </summary>
                                                <pre className="mt-1 p-2 bg-white rounded border max-h-64 overflow-auto text-xs whitespace-pre-wrap break-words">
                                                  {stepData.context}
                                                </pre>
                                              </details>
                                            </div>
                                          ) : (
                                            <div className="space-y-2">
                                              <div className="text-xs text-green-600 mb-2">Object structure:</div>
                                              <div className="max-h-32 overflow-y-auto bg-white p-2 rounded border">
                                                <pre className="text-xs whitespace-pre-wrap break-words">
                                                  {JSON.stringify(stepData.context, null, 2).substring(0, 800)}
                                                  {JSON.stringify(stepData.context, null, 2).length > 800 && '\n...'}
                                                </pre>
                                              </div>
                                              <details className="mt-2">
                                                <summary className="cursor-pointer text-green-600 hover:text-green-800 text-xs">
                                                  View Full Object
                                                </summary>
                                                <pre className="mt-1 p-2 bg-white rounded border max-h-64 overflow-auto text-xs whitespace-pre-wrap break-words">
                                                  {JSON.stringify(stepData.context, null, 2)}
                                                </pre>
                                              </details>
                                            </div>
                                          )}
                                        </div>
                                      </details>
                                    )}

                                    {stepData.action_result && (
                                      <details className="text-xs mb-2">
                                        <summary className="cursor-pointer text-purple-600 hover:text-purple-800 font-medium">
                                          Action Result ({stepData.action_result.length} chars)
                                        </summary>
                                        <div className="mt-1 p-2 bg-purple-50 rounded text-purple-700">
                                          <div className="space-y-2">
                                            <div className="text-xs text-purple-600 mb-2">Content preview:</div>
                                            <div className="max-h-24 overflow-y-auto bg-white p-2 rounded border text-xs break-words">
                                              {stepData.action_result.substring(0, 300)}
                                              {stepData.action_result.length > 300 && '...'}
                                            </div>
                                            {stepData.action_result.length > 300 && (
                                              <details className="mt-2">
                                                <summary className="cursor-pointer text-purple-600 hover:text-purple-800 text-xs">
                                                  View Full Content ({stepData.action_result.length} chars)
                                                </summary>
                                                <pre className="mt-1 p-2 bg-white rounded border max-h-64 overflow-auto text-xs whitespace-pre-wrap break-words">
                                                  {stepData.action_result}
                                                </pre>
                                              </details>
                                            )}
                                          </div>
                                        </div>
                                      </details>
                                    )}

                                    {stepData.selected_action && (
                                      <div className="mb-2 p-2 bg-yellow-50 rounded text-xs">
                                        <div className="font-medium text-yellow-800 mb-1">Selected Action</div>
                                        <div className="text-yellow-700">{stepData.selected_action}</div>
                                      </div>
                                    )}

                                    {stepData.selection_reasoning && (
                                      <details className="text-xs mb-2">
                                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                                          🎯 Conscience Reasoning ({stepData.selection_reasoning.length} chars)
                                        </summary>
                                        <div className="mt-1 p-3 bg-blue-50 rounded text-blue-700">
                                          <div className="space-y-2">
                                            <div className="text-xs text-blue-600 mb-2">Decision rationale:</div>
                                            <div className="bg-white p-2 rounded border text-sm leading-relaxed">
                                              {stepData.selection_reasoning}
                                            </div>
                                          </div>
                                        </div>
                                      </details>
                                    )}

                                    {stepData.action_parameters && (
                                      <details className="text-xs mb-2">
                                        <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800 font-medium">
                                          Action Parameters ({stepData.action_parameters.length} chars)
                                        </summary>
                                        <div className="mt-1 p-2 bg-indigo-50 rounded text-indigo-700">
                                          <div className="space-y-2">
                                            <div className="text-xs text-indigo-600 mb-2">Parameters preview:</div>
                                            <div className="max-h-24 overflow-y-auto bg-white p-2 rounded border text-xs break-words font-mono">
                                              {stepData.action_parameters.substring(0, 200)}
                                              {stepData.action_parameters.length > 200 && '...'}
                                            </div>
                                            {stepData.action_parameters.length > 200 && (
                                              <details className="mt-2">
                                                <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800 text-xs">
                                                  View Full Parameters ({stepData.action_parameters.length} chars)
                                                </summary>
                                                <pre className="mt-1 p-2 bg-white rounded border max-h-64 overflow-auto text-xs whitespace-pre-wrap break-words">
                                                  {stepData.action_parameters}
                                                </pre>
                                              </details>
                                            )}
                                          </div>
                                        </div>
                                      </details>
                                    )}

                                    {/* Show other interesting fields if they exist */}
                                    {(stepData.context_size || stepData.thoughts_processed || stepData.round_status) && (
                                      <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                                        {stepData.context_size && (
                                          <span className="bg-gray-100 px-2 py-1 rounded">
                                            Context: {stepData.context_size} chars
                                          </span>
                                        )}
                                        {stepData.thoughts_processed && (
                                          <span className="bg-gray-100 px-2 py-1 rounded">
                                            Thoughts: {stepData.thoughts_processed}
                                          </span>
                                        )}
                                        {stepData.round_status && (
                                          <span className="bg-gray-100 px-2 py-1 rounded">
                                            Round: {stepData.round_status}
                                          </span>
                                        )}
                                        {stepData.conscience_passed !== undefined && (
                                          <span className={`px-2 py-1 rounded ${stepData.conscience_passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            Conscience: {stepData.conscience_passed ? 'Passed' : 'Failed'}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    {/* Full raw data as fallback */}
                                    <details className="text-xs mt-2">
                                      <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                                        Raw Step Data
                                      </summary>
                                      <pre className="mt-1 p-2 bg-gray-50 rounded overflow-x-auto text-xs whitespace-pre-wrap break-words">
                                        {JSON.stringify(stepData, null, 2)}
                                      </pre>
                                    </details>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                    );
                  })}
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