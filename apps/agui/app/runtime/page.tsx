'use client';

import { useState, useEffect, useRef } from 'react';
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
  const eventSourceRef = useRef<EventSource | null>(null);

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

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    const streamUrl = `${apiBaseUrl}/v1/system/runtime/reasoning-stream?token=${encodeURIComponent(token)}`;
    
    console.log('🔌 Connecting to reasoning stream:', streamUrl);
    
    const eventSource = new EventSource(streamUrl);
    
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', (event) => {
      console.log('✅ Stream connected:', (event as MessageEvent).data);
      setStreamConnected(true);
      setStreamError(null);
    });

    eventSource.addEventListener('step_update', (event) => {
      try {
        const stepData: StreamStepData = JSON.parse((event as MessageEvent).data);
        console.log('📊 Step update received:', stepData);
        
        setStreamData(prev => [...prev.slice(-99), stepData]); // Keep last 100 updates
        
        if (stepData.step_point) {
          setCurrentStepPoint(stepData.step_point);
        }
        if (stepData.step_result) {
          setLastStepResult(stepData.step_result);
        }
        if (stepData.processing_time_ms || stepData.tokens_used) {
          setLastStepMetrics({
            processing_time_ms: stepData.processing_time_ms,
            tokens_used: stepData.tokens_used
          });
        }
      } catch (error) {
        console.error('❌ Error parsing step update:', error);
      }
    });

    eventSource.addEventListener('keepalive', (event) => {
      console.log('💓 Stream keepalive');
    });

    eventSource.addEventListener('error', (event) => {
      try {
        const errorData = JSON.parse((event as MessageEvent).data);
        console.error('❌ Stream error:', errorData);
        setStreamError(`Stream error: ${errorData.message || 'Unknown error'}`);
      } catch {
        console.error('❌ Stream connection error');
        setStreamError('Stream connection failed');
      }
      setStreamConnected(false);
    });

    eventSource.onerror = (error) => {
      console.error('❌ EventSource error:', error);
      setStreamError('Connection lost - attempting to reconnect...');
      setStreamConnected(false);
    };

    return () => {
      console.log('🔌 Closing stream connection');
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, []);

  // Visual step indicators for SVG highlighting
  useEffect(() => {
    if (currentStepPoint) {
      // Add visual highlighting to SVG components based on current step
      // This will be enhanced once we identify specific SVG elements to highlight
      console.log('Current step:', currentStepPoint);
    }
  }, [currentStepPoint]);

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
              <dt className="text-sm font-medium text-gray-500">Current Step</dt>
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
            <div className="min-w-[800px] bg-gray-50 rounded-lg p-4">
              <object 
                data="/ciris-architecture.svg" 
                type="image/svg+xml" 
                className="w-full h-[600px]"
                style={{ maxWidth: '100%', height: 'auto' }}
              >
                <img 
                  src="/ciris-architecture.svg" 
                  alt="CIRIS Architecture Diagram" 
                  className="w-full h-auto"
                />
              </object>
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