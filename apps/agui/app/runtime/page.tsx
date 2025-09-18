'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cirisClient } from '../../lib/ciris-sdk';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { StatusDot } from '../../components/Icons';
import { StepVisualization } from './components/StepVisualization';
import { 
  StepPoint, 
  StepResult, 
  EnhancedSingleStepResponse 
} from '../../lib/ciris-sdk/types';

// H3ERE Pipeline Step Points (11 steps: 0-10)
enum H3EREStepPoint {
  START_ROUND = 'START_ROUND',
  GATHER_CONTEXT = 'GATHER_CONTEXT', 
  PERFORM_DMAS = 'PERFORM_DMAS',
  PERFORM_ASPDMA = 'PERFORM_ASPDMA',
  CONSCIENCE_EXECUTION = 'CONSCIENCE_EXECUTION',
  RECURSIVE_ASPDMA = 'RECURSIVE_ASPDMA',
  RECURSIVE_CONSCIENCE = 'RECURSIVE_CONSCIENCE', 
  FINALIZE_ACTION = 'FINALIZE_ACTION',
  PERFORM_ACTION = 'PERFORM_ACTION',
  ACTION_COMPLETE = 'ACTION_COMPLETE',
  ROUND_COMPLETE = 'ROUND_COMPLETE'
}

interface StreamStepData {
  step_point?: H3EREStepPoint;
  step_result?: any;
  processing_time_ms?: number;
  tokens_used?: number;
  pipeline_state?: any;
  transparency_data?: any;
  timestamp: string;
}

// Thought tracking interfaces
interface ThoughtStep {
  step_point: H3EREStepPoint;
  step_name: string;
  step_category: string;
  timestamp: string;
  processing_time_ms?: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'blocked';
  content_preview?: string;
  error?: string;
  step_result?: any;  // Store the full step result
  transparency_data?: any;  // Store transparency data
  progress_percentage?: number;
  round_number?: number;
  stream_sequence?: number;  // Track which update this came from
  raw_server_data?: any;  // Store the complete raw data from server
}

interface TrackedThought {
  thought_id: string;
  task_id: string;
  thought_type: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'blocked';
  current_step?: H3EREStepPoint;
  steps: Map<H3EREStepPoint, ThoughtStep>;
  started_at?: string;
  completed_at?: string;
  total_processing_time_ms?: number;
  last_updated: string;
  steps_completed?: string[];  // Track completed step names
  steps_remaining?: string[];  // Track remaining step names
}

interface TrackedTask {
  task_id: string;
  thoughts: Map<string, TrackedThought>;
  created_at: string;
  last_updated: string;
}

export default function RuntimeControlPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [currentStepPoint, setCurrentStepPoint] = useState<H3EREStepPoint | null>(null);
  const [lastStepResult, setLastStepResult] = useState<any | null>(null);
  const [lastStepMetrics, setLastStepMetrics] = useState<{
    processing_time_ms?: number;
    tokens_used?: number;
  } | null>(null);
  
  // Track processor state from API responses
  const [processorState, setProcessorState] = useState<string>('running');
  
  // Streaming state
  const [streamData, setStreamData] = useState<StreamStepData[]>([]);
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Task and thought tracking state
  const [trackedTasks, setTrackedTasks] = useState<Map<string, TrackedTask>>(new Map());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedThoughts, setExpandedThoughts] = useState<Set<string>>(new Set());

  // Fetch runtime state
  const { data: runtimeState, refetch: refetchRuntimeState } = useQuery({
    queryKey: ['runtime-state'],
    queryFn: () => cirisClient.system.getRuntimeState(),
    refetchInterval: 2000,
  });

  // Enhanced single-step mutation
  const singleStepMutation = useMutation({
    mutationFn: async (): Promise<EnhancedSingleStepResponse> => {
      if (!hasRole('ADMIN')) {
        throw new Error('Admin privileges required to execute single steps');
      }
      return await cirisClient.system.singleStepProcessorEnhanced(true);
    },
    onSuccess: (data) => {
      toast.success(`Step completed: ${data.message}`);
      // Convert old StepPoint to H3EREStepPoint if needed
      if (data.step_point) {
        // For now, just log the step - the streaming endpoint will handle updates
        console.log('Single step completed:', data.step_point);
      }
      if (data.step_result) {
        setLastStepResult(data.step_result);
      }
      // Capture performance metrics
      setLastStepMetrics({
        processing_time_ms: data.processing_time_ms,
        tokens_used: data.tokens_used,
      });
      refetchRuntimeState();
    },
    onError: (error: any) => {
      const message = error.message || 'Unknown error';
      toast.error(`Step failed: ${message}`);
    },
  });

  // Runtime control mutations
  const pauseMutation = useMutation({
    mutationFn: () => {
      if (!hasRole('ADMIN')) {
        throw new Error('Admin privileges required to pause runtime');
      }
      return cirisClient.system.pauseRuntime();
    },
    onSuccess: (data: any) => {
      toast.success('Runtime paused');
      // Update processor state from API response
      if (data.processor_state) {
        setProcessorState(data.processor_state);
      }
      refetchRuntimeState();
    },
    onError: (error: any) => {
      const message = error.message || 'Failed to pause runtime';
      toast.error(message);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => {
      if (!hasRole('ADMIN')) {
        throw new Error('Admin privileges required to resume runtime');
      }
      return cirisClient.system.resumeRuntime();
    },
    onSuccess: (data: any) => {
      toast.success('Runtime resumed');
      // Update processor state from API response
      if (data.processor_state) {
        setProcessorState(data.processor_state === 'active' ? 'running' : data.processor_state);
      }
      setCurrentStepPoint(null);
      setLastStepResult(null);
      setLastStepMetrics(null);
      refetchRuntimeState();
    },
    onError: (error: any) => {
      const message = error.message || 'Failed to resume runtime';
      toast.error(message);
    },
  });

  // H3ERE Pipeline step display names (11 steps: 0-10)
  const getH3EREStepDisplayName = (step: H3EREStepPoint): string => {
    const names: Record<H3EREStepPoint, string> = {
      [H3EREStepPoint.START_ROUND]: '0. Start Round',
      [H3EREStepPoint.GATHER_CONTEXT]: '1. Gather Context',
      [H3EREStepPoint.PERFORM_DMAS]: '2. Perform DMAs',
      [H3EREStepPoint.PERFORM_ASPDMA]: '3. Perform ASPDMA', 
      [H3EREStepPoint.CONSCIENCE_EXECUTION]: '4. Conscience Execution',
      [H3EREStepPoint.RECURSIVE_ASPDMA]: '3B. Recursive ASPDMA',
      [H3EREStepPoint.RECURSIVE_CONSCIENCE]: '4B. Recursive Conscience',
      [H3EREStepPoint.FINALIZE_ACTION]: '5. Finalize Action',
      [H3EREStepPoint.PERFORM_ACTION]: '6. Perform Action',
      [H3EREStepPoint.ACTION_COMPLETE]: '7. Action Complete',
      [H3EREStepPoint.ROUND_COMPLETE]: '8. Round Complete'
    };
    return names[step] || step;
  };

  // Initialize Server-Sent Events stream for real-time step updates
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
            fullUpdate: update  // Log the entire update to see all fields
          });
          
          // Process thoughts and steps from the update
          if (update.updated_thoughts && Array.isArray(update.updated_thoughts)) {
            setTrackedTasks(prevTasks => {
              const newTasks = new Map(prevTasks);
              
              // First, we need to find if this thought already exists in any task
              update.updated_thoughts.forEach((thought: any) => {
                const thoughtId = thought.thought_id;
                let taskId = thought.task_id || '';
                
                // Debug log to see the thought structure
                console.log('🔍 Full thought data:', thought);  // Log entire thought object
                console.log('📝 Thought summary:', {
                  id: thoughtId,
                  task_id: taskId,
                  current_step: thought.current_step,
                  steps_completed: thought.steps_completed,
                  steps_remaining: thought.steps_remaining,
                  progress: thought.progress_percentage,
                  all_fields: Object.keys(thought).join(', ')  // Show all fields present
                });
                
                // Check if this thought already exists in any task
                let existingTask = null;
                let existingThought = null;
                
                for (const [tid, task] of newTasks.entries()) {
                  if (task.thoughts.has(thoughtId)) {
                    existingTask = task;
                    existingThought = task.thoughts.get(thoughtId);
                    // If we found the thought in an existing task, use that task's ID
                    // unless we have a valid task_id in the current update
                    if (!taskId || taskId === 'unknown') {
                      taskId = tid;
                    } else if (taskId !== tid && tid !== 'unknown') {
                      // Move the thought to the correct task if task_id changed
                      task.thoughts.delete(thoughtId);
                      if (task.thoughts.size === 0) {
                        newTasks.delete(tid);
                      }
                    }
                    break;
                  }
                }
                
                // If no task_id provided and thought doesn't exist, generate one
                if (!taskId) {
                  taskId = 'unknown';
                }
                
                // Get or create task
                let task = newTasks.get(taskId);
                if (!task) {
                  task = {
                    task_id: taskId,
                    thoughts: new Map(),
                    created_at: update.timestamp || new Date().toISOString(),
                    last_updated: update.timestamp || new Date().toISOString()
                  };
                  newTasks.set(taskId, task);
                }
                
                // Get or create thought (may have been moved from another task)
                let trackedThought = task.thoughts.get(thoughtId) || existingThought;
                if (!trackedThought) {
                  trackedThought = {
                    thought_id: thoughtId,
                    task_id: taskId,
                    thought_type: thought.thought_type || 'unknown',
                    status: thought.status,
                    current_step: thought.current_step,
                    steps: new Map(),
                    started_at: thought.started_at,
                    last_updated: update.timestamp || new Date().toISOString()
                  };
                  task.thoughts.set(thoughtId, trackedThought);
                } else {
                  // Move the thought to the current task if needed
                  task.thoughts.set(thoughtId, trackedThought);
                }
                
                // Update thought status and current step
                if (trackedThought) {
                  trackedThought.status = thought.status;
                  trackedThought.current_step = thought.current_step;
                  trackedThought.last_updated = update.timestamp || new Date().toISOString();
                  trackedThought.steps_completed = thought.steps_completed;
                  trackedThought.steps_remaining = thought.steps_remaining;
                
                  // If thought is completed, ensure all 9 core steps are marked as completed
                  if (thought.status === 'completed' || thought.status === 'complete') {
                    console.log('✅ Thought completed, ensuring all core steps are tracked');
                    const coreSteps = [
                      H3EREStepPoint.START_ROUND,
                      H3EREStepPoint.GATHER_CONTEXT,
                      H3EREStepPoint.PERFORM_DMAS,
                      H3EREStepPoint.PERFORM_ASPDMA,
                      H3EREStepPoint.CONSCIENCE_EXECUTION,
                      H3EREStepPoint.FINALIZE_ACTION,
                      H3EREStepPoint.PERFORM_ACTION,
                      H3EREStepPoint.ACTION_COMPLETE,
                      H3EREStepPoint.ROUND_COMPLETE
                    ];
                    
                    const thoughtSteps = trackedThought.steps;  // Capture the reference
                    coreSteps.forEach(step => {
                      if (!thoughtSteps.has(step)) {
                        thoughtSteps.set(step, {
                          step_point: step,
                          step_name: step.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase()),
                        step_category: 'inferred',
                        timestamp: update.timestamp || new Date().toISOString(),
                        status: 'completed',
                        content_preview: 'Step completed (inferred from thought completion)'
                      });
                      console.log(`➕ Added inferred completed step: ${step}`);
                    }
                  });
                  }
                }
                
                // Check if there's a completed_steps array we should process
                if (thought.completed_steps && Array.isArray(thought.completed_steps) && trackedThought) {
                  console.log('📋 Found completed_steps array:', thought.completed_steps);
                  const thoughtSteps = trackedThought.steps;  // Capture the reference
                  thought.completed_steps.forEach((completedStep: any) => {
                    const stepEnum = completedStep.toUpperCase().replace(/ /g, '_') as H3EREStepPoint;
                    if (!thoughtSteps.has(stepEnum)) {
                      thoughtSteps.set(stepEnum, {
                        step_point: stepEnum,
                        step_name: completedStep.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase()),
                        step_category: 'completed',
                        timestamp: update.timestamp || new Date().toISOString(),
                        status: 'completed',
                      });
                      console.log(`📋 Added completed step from array: ${stepEnum}`);
                    }
                  });
                }
                
                // Also check for step_history or pipeline_steps
                if (thought.step_history && Array.isArray(thought.step_history) && trackedThought) {
                  console.log('📜 Found step_history:', thought.step_history);
                  const thoughtSteps = trackedThought.steps;  // Capture the reference
                  thought.step_history.forEach((stepInfo: any) => {
                    const stepEnum = (stepInfo.step_name || stepInfo.step || stepInfo).toUpperCase().replace(/ /g, '_') as H3EREStepPoint;
                    if (!thoughtSteps.has(stepEnum) && Object.values(H3EREStepPoint).includes(stepEnum)) {
                      thoughtSteps.set(stepEnum, {
                        step_point: stepEnum,
                        step_name: (stepInfo.step_name || stepInfo.step || stepInfo).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase()),
                        step_category: stepInfo.category || 'historical',
                        timestamp: stepInfo.timestamp || update.timestamp || new Date().toISOString(),
                        status: stepInfo.status || 'completed',
                        processing_time_ms: stepInfo.processing_time_ms,
                        content_preview: stepInfo.content_preview,
                        step_result: stepInfo.result
                      });
                      console.log(`📜 Added step from history: ${stepEnum}`);
                    }
                  });
                }
                
                // Check for pipeline_steps
                if (thought.pipeline_steps && typeof thought.pipeline_steps === 'object' && trackedThought) {
                  console.log('🔧 Found pipeline_steps:', thought.pipeline_steps);
                  const thoughtSteps = trackedThought.steps;  // Capture the reference
                  Object.entries(thought.pipeline_steps).forEach(([stepName, stepData]: [string, any]) => {
                    const stepEnum = stepName.toUpperCase().replace(/ /g, '_') as H3EREStepPoint;
                    if (!thoughtSteps.has(stepEnum) && Object.values(H3EREStepPoint).includes(stepEnum)) {
                      thoughtSteps.set(stepEnum, {
                        step_point: stepEnum,
                        step_name: stepName.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase()),
                        step_category: stepData.category || 'pipeline',
                        timestamp: stepData.timestamp || update.timestamp || new Date().toISOString(),
                        status: stepData.status || 'completed',
                        processing_time_ms: stepData.processing_time_ms,
                        content_preview: stepData.content_preview,
                        step_result: stepData.result,
                        transparency_data: stepData.transparency_data
                      });
                      console.log(`🔧 Added step from pipeline: ${stepEnum}`);
                    }
                  });
                }
                
                // Map current step name to enum - handle different formats
                let currentStepEnum: H3EREStepPoint | undefined;
                if (thought.current_step) {
                  // Try direct mapping first
                  currentStepEnum = thought.current_step as H3EREStepPoint;
                  
                  // If not a valid enum value, try converting format
                  if (!Object.values(H3EREStepPoint).includes(currentStepEnum)) {
                    currentStepEnum = thought.current_step.toUpperCase().replace(/ /g, '_') as H3EREStepPoint;
                  }
                  
                  console.log('🎯 Step mapping:', {
                    original: thought.current_step,
                    mapped: currentStepEnum,
                    isValidEnum: Object.values(H3EREStepPoint).includes(currentStepEnum)
                  });
                }
                
                // ALWAYS update the current step with the latest data from this update
                if (currentStepEnum && Object.values(H3EREStepPoint).includes(currentStepEnum)) {
                  // Store or update the step with ALL the unique data from this update
                  const stepData: ThoughtStep = {
                    step_point: currentStepEnum,
                    step_name: thought.current_step.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (l: string) => l.toUpperCase()),
                    step_category: thought.step_category || 'unknown',
                    timestamp: thought.current_step_started_at || update.timestamp || new Date().toISOString(),
                    status: thought.status || 'processing',
                    processing_time_ms: thought.processing_time_ms,
                    content_preview: thought.content_preview,
                    error: thought.last_error,
                    step_result: thought.step_result,
                    transparency_data: thought.transparency_data,
                    progress_percentage: thought.progress_percentage,
                    round_number: thought.round_number,
                    stream_sequence: update.stream_sequence,
                    raw_server_data: thought  // Store the complete thought data from server
                  };
                  
                  // Store this step data
                  trackedThought.steps.set(currentStepEnum, stepData);
                  console.log(`✅ Stored step ${currentStepEnum}, total steps: ${trackedThought.steps.size}`);
                  
                  // Trigger animation for this step
                  setCurrentStepPoint(currentStepEnum);
                  
                  // Also check if we need to mark previous steps as completed
                  const coreSteps = [
                    H3EREStepPoint.START_ROUND,
                    H3EREStepPoint.GATHER_CONTEXT,
                    H3EREStepPoint.PERFORM_DMAS,
                    H3EREStepPoint.PERFORM_ASPDMA,
                    H3EREStepPoint.CONSCIENCE_EXECUTION,
                    H3EREStepPoint.FINALIZE_ACTION,
                    H3EREStepPoint.PERFORM_ACTION,
                    H3EREStepPoint.ACTION_COMPLETE,
                    H3EREStepPoint.ROUND_COMPLETE
                  ];
                  
                  // Find the index of the current step
                  const currentStepIndex = coreSteps.indexOf(currentStepEnum);
                  console.log(`📍 Current step index: ${currentStepIndex} of ${coreSteps.length}`);
                  
                  // Mark previous steps as completed if we haven't seen them yet
                  if (currentStepIndex > 0) {
                    for (let i = 0; i < currentStepIndex; i++) {
                      const prevStep = coreSteps[i];
                      if (!trackedThought.steps.has(prevStep)) {
                        // This step was completed but we didn't see its update
                        trackedThought.steps.set(prevStep, {
                          step_point: prevStep,
                          step_name: prevStep.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
                          step_category: 'completed',
                          timestamp: update.timestamp || new Date().toISOString(),
                          status: 'completed',
                        });
                        console.log(`⏮️ Backfilled completed step: ${prevStep}`);
                      }
                    }
                  }
                  
                  // Also infer completed steps based on steps_remaining count
                  if (thought.steps_remaining && Array.isArray(thought.steps_remaining)) {
                    const remainingCount = thought.steps_remaining.length;
                    const totalSteps = 9; // Always 9 core steps
                    const completedCount = totalSteps - remainingCount;
                    
                    console.log(`📊 Steps progress: ${completedCount} completed, ${remainingCount} remaining`);
                    
                    // Mark the first N steps as completed based on count
                    for (let i = 0; i < completedCount && i < coreSteps.length; i++) {
                      const step = coreSteps[i];
                      if (!trackedThought.steps.has(step)) {
                        trackedThought.steps.set(step, {
                          step_point: step,
                          step_name: step.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
                          step_category: 'inferred',
                          timestamp: update.timestamp || new Date().toISOString(),
                          status: 'completed',
                          content_preview: 'Step completed (inferred from remaining count)'
                        });
                        console.log(`📊 Inferred completed step from count: ${step}`);
                      }
                    }
                  }
                  
                  // Handle recursive steps specially
                  if (currentStepEnum === H3EREStepPoint.RECURSIVE_ASPDMA || 
                      currentStepEnum === H3EREStepPoint.RECURSIVE_CONSCIENCE) {
                    // Make sure CONSCIENCE_EXECUTION is marked as completed (it failed, triggering recursion)
                    const conscienceStep = trackedThought.steps.get(H3EREStepPoint.CONSCIENCE_EXECUTION);
                    if (conscienceStep && conscienceStep.status !== 'completed') {
                      conscienceStep.status = 'completed';
                      conscienceStep.error = 'Conscience check failed - triggered recursive analysis';
                    }
                  }
                }
                
                
                // Update total processing time
                if (thought.total_processing_time_ms) {
                  trackedThought.total_processing_time_ms = thought.total_processing_time_ms;
                }
                
                // Update task last_updated
                task.last_updated = update.timestamp || new Date().toISOString();
              });
              
              return newTasks;
            });
          }
          
          // Store raw stream data for backward compatibility
          const stepData: StreamStepData = {
            timestamp: update.timestamp || new Date().toISOString(),
            step_point: update.current_step,
            pipeline_state: update
          };
          setStreamData(prev => [...prev.slice(-99), stepData]);
          
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

    // Events are now handled in processSSEEvent function above

    return () => {
      console.log('🔌 Closing stream connection');
      abortController.abort();
      abortControllerRef.current = null;
    };
  }, []);

  // Track animated steps
  const [animatedSteps, setAnimatedSteps] = useState<Set<string>>(new Set());
  const [svgContent, setSvgContent] = useState<string>('');
  const [lastAnimatedStep, setLastAnimatedStep] = useState<H3EREStepPoint | null>(null);
  const [lastAnimationTime, setLastAnimationTime] = useState<number>(0);
  
  // Load the SVG content
  useEffect(() => {
    fetch('/pipeline-visualization.svg')
      .then(res => res.text())
      .then(svg => setSvgContent(svg))
      .catch(err => console.error('Failed to load SVG:', err));
  }, []);
  
  // Map H3ERE step points to new SVG element IDs
  const stepToSvgId: Record<H3EREStepPoint, string | null> = {
    [H3EREStepPoint.START_ROUND]: '0-start',
    [H3EREStepPoint.GATHER_CONTEXT]: '1-context',
    [H3EREStepPoint.PERFORM_DMAS]: '2-perform-dma',
    [H3EREStepPoint.PERFORM_ASPDMA]: '3-perform-aspdma',
    [H3EREStepPoint.CONSCIENCE_EXECUTION]: '4-conscience',
    [H3EREStepPoint.FINALIZE_ACTION]: '5-option-handler',
    [H3EREStepPoint.PERFORM_ACTION]: '6-handler',
    [H3EREStepPoint.ACTION_COMPLETE]: '6-handler-execution',
    [H3EREStepPoint.ROUND_COMPLETE]: '8-round-complete',
    [H3EREStepPoint.RECURSIVE_ASPDMA]: '3-perform-aspdma', // Recursive - reuses step 3
    [H3EREStepPoint.RECURSIVE_CONSCIENCE]: '4-conscience', // Recursive - reuses step 4
  };
  
  // Function to animate a step - simple and direct with spam prevention
  const animateStep = useCallback((step: H3EREStepPoint) => {
    const now = Date.now();
    
    // Prevent spam: skip if same step within 1 second
    if (step === lastAnimatedStep && now - lastAnimationTime < 1000) {
      console.log(`🚫 Skipping duplicate step: ${step} (too recent)`);
      return;
    }
    
    const svgId = stepToSvgId[step];
    if (!svgId) return;
    
    console.log(`🎨 Animating step: ${step} -> SVG ID: ${svgId}`);
    setLastAnimatedStep(step);
    setLastAnimationTime(now);
    
    // Check if the element actually exists in the DOM
    setTimeout(() => {
      const element = document.getElementById(svgId);
      console.log(`🔍 Element ${svgId} found:`, !!element);
      if (element) {
        console.log(`📍 Element type: ${element.tagName}, classes: ${element.className}`);
      }
      
      // For ACTION_COMPLETE or ROUND_COMPLETE, animate both steps 7 and 8
      const stepsToAnimate = [step];
      if (step === H3EREStepPoint.ACTION_COMPLETE || step === H3EREStepPoint.ROUND_COMPLETE) {
        stepsToAnimate.push(
          step === H3EREStepPoint.ACTION_COMPLETE ? H3EREStepPoint.ROUND_COMPLETE : H3EREStepPoint.ACTION_COMPLETE
        );
      }
      
      stepsToAnimate.forEach(stepToAnimate => {
        const targetSvgId = stepToSvgId[stepToAnimate];
        if (targetSvgId) {
          setAnimatedSteps(prev => new Set([...prev, targetSvgId]));
          
          // Remove animation after 2 seconds
          setTimeout(() => {
            setAnimatedSteps(prev => {
              const newSet = new Set(prev);
              newSet.delete(targetSvgId);
              return newSet;
            });
          }, 2000);
        }
      });
    }, 100);
  }, [stepToSvgId, lastAnimatedStep, lastAnimationTime]);
  
  // Visual step indicators for SVG highlighting
  useEffect(() => {
    if (currentStepPoint) {
      console.log('Current step:', currentStepPoint);
      animateStep(currentStepPoint);
    }
  }, [currentStepPoint, animateStep]);

  const isPaused = processorState === 'paused';
  const isRunning = processorState === 'running';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white shadow">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-2xl font-bold text-gray-900">Runtime Control</h2>
          <p className="mt-1 text-sm text-gray-500">
            Step-by-step debugging and visualization of CIRIS ethical reasoning pipeline
          </p>
        </div>
      </div>

      {/* Runtime Status & Controls */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">Pipeline Control</h3>
            <div className="flex items-center space-x-2">
              <StatusDot 
                status={isPaused ? 'yellow' : isRunning ? 'green' : 'gray'} 
                className="mr-2" 
              />
              <span className="text-sm font-medium text-gray-600">
                {processorState?.toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center space-x-4 mb-6">
            {!hasRole('ADMIN') && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Admin Access Required</h3>
                    <p className="text-sm text-yellow-700 mt-1">Runtime control operations require Administrator privileges. You can view the current state but cannot modify runtime execution.</p>
                  </div>
                </div>
              </div>
            )}
            
            <button
              onClick={() => pauseMutation.mutate()}
              disabled={isPaused || pauseMutation.isPending || !hasRole('ADMIN')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pauseMutation.isPending ? 'Pausing...' : 'Pause'}
            </button>

            <button
              onClick={() => resumeMutation.mutate()}
              disabled={!isPaused || resumeMutation.isPending || !hasRole('ADMIN')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resumeMutation.isPending ? 'Resuming...' : 'Resume'}
            </button>

            <button
              onClick={() => singleStepMutation.mutate()}
              disabled={!isPaused || singleStepMutation.isPending || !hasRole('ADMIN')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {singleStepMutation.isPending ? 'Stepping...' : 'Single Step'}
            </button>
            
            {!hasRole('ADMIN') && (
              <span className="text-sm text-gray-500 ml-4">Controls disabled - Admin role required</span>
            )}
          </div>

          {/* Pipeline Status Info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="bg-gray-50 px-4 py-5 sm:p-6 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Cognitive State</dt>
              <dd className="mt-1 text-xl font-semibold text-gray-900">
                {runtimeState?.cognitive_state || 'WORK'}
              </dd>
            </div>

            <div className="bg-gray-50 px-4 py-5 sm:p-6 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Queue Depth</dt>
              <dd className="mt-1 text-xl font-semibold text-gray-900">
                {runtimeState?.queue_depth || 0}
              </dd>
            </div>

            <div className="bg-gray-50 px-4 py-5 sm:p-6 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Most Recent Event</dt>
              <dd className="mt-1 text-lg font-semibold text-blue-600">
                {currentStepPoint ? getH3EREStepDisplayName(currentStepPoint) : 'None'}
              </dd>
            </div>

            <div className="bg-gray-50 px-4 py-5 sm:p-6 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Step Time</dt>
              <dd className="mt-1 text-xl font-semibold text-green-600">
                {lastStepMetrics?.processing_time_ms ? `${lastStepMetrics.processing_time_ms}ms` : 'N/A'}
              </dd>
            </div>

            <div className="bg-gray-50 px-4 py-5 sm:p-6 rounded-lg">
              <dt className="text-sm font-medium text-gray-500">Tokens Used</dt>
              <dd className="mt-1 text-xl font-semibold text-purple-600">
                {lastStepMetrics?.tokens_used ? lastStepMetrics.tokens_used.toLocaleString() : 'N/A'}
              </dd>
            </div>
          </div>
        </div>
      </div>

      {/* Stream Status */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Real-time Stream Status</h3>
            <div className="flex items-center space-x-2">
              <StatusDot 
                status={streamConnected ? 'green' : 'red'} 
                className="mr-2" 
              />
              <span className="text-sm font-medium text-gray-600">
                {streamConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
          </div>
          
          {streamError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-sm text-red-800">{streamError}</p>
            </div>
          )}
          
          <div className="text-sm text-gray-600">
            <p>Updates received: {streamData.length}</p>
            <p>Endpoint: /v1/system/runtime/reasoning-stream</p>
          </div>
        </div>
      </div>

      {/* H3ERE Pipeline Visualization */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">H3ERE Pipeline (11 Step Points)</h3>
          
          {/* SVG Container with responsive sizing */}
          <div className="w-full overflow-x-auto">
            <div className="min-w-[1200px] bg-gray-50 rounded-lg p-4">
              <style dangerouslySetInnerHTML={{ __html: `
                ${Array.from(animatedSteps).map(id => `
                  #${id}, g#${id} {
                    stroke: #ff0000 !important;
                    fill: #ff0000 !important;
                    stroke-width: 5 !important;
                    opacity: 1 !important;
                    animation: simplePulse 1s ease-in-out infinite !important;
                  }
                  #${id} *, g#${id} * {
                    stroke: #ff0000 !important;
                    fill: #ff0000 !important;
                    stroke-width: 3 !important;
                    opacity: 1 !important;
                  }
                `).join('')}
                
                @keyframes simplePulse {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.3; }
                }
              ` }} />
              {svgContent ? (
                <div dangerouslySetInnerHTML={{ __html: svgContent }} />
              ) : (
                <div className="flex items-center justify-center h-[150px] text-gray-500">
                  Loading pipeline visualization...
                </div>
              )}
            </div>
          </div>

          {/* H3ERE Step Indicator Legend */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">H3ERE Pipeline Step Indicators</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {Object.values(H3EREStepPoint).map((step) => (
                <div 
                  key={step}
                  className={`flex items-center space-x-1 px-2 py-1 rounded ${
                    currentStepPoint === step 
                      ? 'bg-blue-200 text-blue-900 font-semibold' 
                      : 'text-blue-700'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    currentStepPoint === step ? 'bg-blue-600 animate-pulse' : 'bg-blue-400'
                  }`}></span>
                  <span>{getH3EREStepDisplayName(step)}</span>
                  {step === H3EREStepPoint.RECURSIVE_ASPDMA && <span className="text-orange-600">(conditional)</span>}
                  {step === H3EREStepPoint.RECURSIVE_CONSCIENCE && <span className="text-orange-600">(conditional)</span>}
                </div>
              ))}
            </div>
            
            <div className="mt-3 text-xs text-blue-600">
              <p><strong>Note:</strong> Steps 3B & 4B are conditional - only executed when conscience evaluation fails.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Step Details Panel */}
      {lastStepResult && currentStepPoint && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Live Step Details</h3>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {getH3EREStepDisplayName(currentStepPoint)}
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h4 className="font-medium text-gray-900 mb-2">Raw Step Data:</h4>
              <pre className="text-sm text-gray-600 overflow-x-auto">
                {JSON.stringify(lastStepResult, null, 2)}
              </pre>
            </div>
            
            {/* Stream Data History */}
            {streamData.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-900 mb-2">Recent Updates ({streamData.slice(-5).length} of {streamData.length}):</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {streamData.slice(-5).reverse().map((data, index) => (
                    <div key={index} className="text-xs bg-white border rounded p-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-blue-600">
                          {data.step_point ? getH3EREStepDisplayName(data.step_point) : 'No step point'}
                        </span>
                        <span className="text-gray-500">
                          {new Date(data.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      {data.processing_time_ms && (
                        <span className="text-green-600">⏱️ {data.processing_time_ms}ms</span>
                      )}
                      {data.tokens_used && (
                        <span className="text-purple-600 ml-2">🪙 {data.tokens_used} tokens</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* Task/Thought/Step Tracking Table */}
      {trackedTasks.size > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Task & Thought Pipeline Tracking
          </h2>
          
          <div className="space-y-4">
            {Array.from(trackedTasks.entries()).map(([taskId, task]) => (
              <div key={taskId} className="border border-gray-200 rounded-lg">
                {/* Task Header */}
                <div 
                  className="px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => {
                    setExpandedTasks(prev => {
                      const next = new Set(prev);
                      if (next.has(taskId)) {
                        next.delete(taskId);
                      } else {
                        next.add(taskId);
                      }
                      return next;
                    });
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-400">
                        {expandedTasks.has(taskId) ? '▼' : '▶'}
                      </span>
                      <span className="font-medium text-gray-900">
                        Task: {taskId === 'unknown' ? 'System Task' : taskId.substring(0, 12) + '...'}
                      </span>
                      <span className="text-sm text-gray-500">
                        ({task.thoughts.size} thought{task.thoughts.size !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      Updated: {new Date(task.last_updated).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                
                {/* Thoughts for this Task */}
                {expandedTasks.has(taskId) && (
                  <div className="border-t border-gray-200">
                    {Array.from(task.thoughts.entries()).map(([thoughtId, thought]) => (
                      <div key={thoughtId} className="border-b border-gray-100 last:border-b-0">
                        {/* Thought Header */}
                        <div 
                          className="px-6 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => {
                            setExpandedThoughts(prev => {
                              const next = new Set(prev);
                              if (next.has(thoughtId)) {
                                next.delete(thoughtId);
                              } else {
                                next.add(thoughtId);
                              }
                              return next;
                            });
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <span className="text-gray-400 text-sm">
                                {expandedThoughts.has(thoughtId) ? '▼' : '▶'}
                              </span>
                              <span className="text-sm font-medium text-gray-700">
                                {thought.thought_id.substring(0, 20)}...
                              </span>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                thought.status === 'completed' ? 'bg-green-100 text-green-800' :
                                thought.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                thought.status === 'failed' ? 'bg-red-100 text-red-800' :
                                thought.status === 'blocked' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {thought.status}
                              </span>
                              <span className="text-xs text-gray-500">
                                Type: {thought.thought_type}
                              </span>
                              <span className="text-xs text-gray-500">
                                Steps: {thought.steps.size}/11
                              </span>
                            </div>
                            {thought.total_processing_time_ms && (
                              <span className="text-xs text-gray-500">
                                Total: {thought.total_processing_time_ms.toFixed(1)}ms
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Steps for this Thought */}
                        {expandedThoughts.has(thoughtId) && thought.steps.size > 0 && (
                          <div className="px-8 py-3 bg-gray-50">
                            <div className="space-y-2">
                              <div className="text-xs font-semibold text-gray-600 mb-2">
                                Pipeline Steps (in order):
                              </div>
                              {Array.from(thought.steps.entries())
                                .sort(([a], [b]) => {
                                  const order = Object.values(H3EREStepPoint);
                                  return order.indexOf(a as any) - order.indexOf(b as any);
                                })
                                .map(([stepPoint, step]) => (
                                  <div key={stepPoint} className="flex items-start space-x-3 text-xs">
                                    <div className="flex-shrink-0 w-32">
                                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                        step.status === 'completed' ? 'bg-green-100 text-green-800' :
                                        step.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                        step.status === 'failed' ? 'bg-red-100 text-red-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {step.step_name}
                                      </span>
                                    </div>
                                    <div className="flex-1 space-y-1">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-gray-500">
                                          Category: {step.step_category}
                                        </span>
                                        {step.processing_time_ms && (
                                          <span className="text-gray-500">
                                            • {step.processing_time_ms.toFixed(1)}ms
                                          </span>
                                        )}
                                        {step.progress_percentage !== undefined && (
                                          <span className="text-gray-500">
                                            • {step.progress_percentage.toFixed(1)}%
                                          </span>
                                        )}
                                        {step.stream_sequence !== undefined && (
                                          <span className="text-gray-400">
                                            • Seq: {step.stream_sequence}
                                          </span>
                                        )}
                                        <span className="text-gray-400">
                                          • {new Date(step.timestamp).toLocaleTimeString()}
                                        </span>
                                      </div>
                                      {step.content_preview && (
                                        <div className="text-gray-600 italic">
                                          "{step.content_preview}"
                                        </div>
                                      )}
                                      {step.step_result && (
                                        <details className="text-xs">
                                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                            Step Result Data
                                          </summary>
                                          <pre className="mt-1 p-2 bg-gray-100 rounded text-xs whitespace-pre-wrap break-words max-w-full overflow-hidden">
                                            {JSON.stringify(step.step_result, null, 2)}
                                          </pre>
                                        </details>
                                      )}
                                      {step.transparency_data && (
                                        <details className="text-xs">
                                          <summary className="cursor-pointer text-purple-600 hover:text-purple-800">
                                            Transparency Data
                                          </summary>
                                          <pre className="mt-1 p-2 bg-purple-50 rounded text-xs whitespace-pre-wrap break-words max-w-full overflow-hidden">
                                            {JSON.stringify(step.transparency_data, null, 2)}
                                          </pre>
                                        </details>
                                      )}
                                      {step.raw_server_data && (
                                        <details className="text-xs">
                                          <summary className="cursor-pointer text-orange-600 hover:text-orange-800">
                                            Raw Server Data
                                          </summary>
                                          <pre className="mt-1 p-2 bg-orange-50 rounded text-xs whitespace-pre-wrap break-words max-w-full overflow-hidden">
                                            {JSON.stringify(step.raw_server_data, null, 2)}
                                          </pre>
                                        </details>
                                      )}
                                      {step.error && (
                                        <div className="text-red-600">
                                          Error: {step.error}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">How to use Runtime Control</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ol className="list-decimal list-inside space-y-1">
                <li><strong>Real-time Stream</strong>: Connects to /v1/system/runtime/reasoning-stream for live updates</li>
                <li><strong>H3ERE Pipeline</strong>: 11 step points (0-10) with conditional recursive steps</li>
                <li><strong>Pause/Resume</strong>: Control processing while maintaining stream connection</li>
                <li><strong>Single Step</strong>: Execute one pipeline step (when paused)</li>
                <li><strong>Live Visualization</strong>: See reasoning process in real-time during normal operation</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}