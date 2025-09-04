'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cirisClient } from '../../lib/ciris-sdk';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { StatusDot } from '../../components/Icons';
import { StepVisualization } from './components/StepVisualization';
import { isDemoMode, getDemoStepResult } from './components/DemoData';
import { 
  StepPoint, 
  StepResult, 
  EnhancedSingleStepResponse 
} from '../../lib/ciris-sdk/types';

export default function RuntimeControlPage() {
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [currentStepPoint, setCurrentStepPoint] = useState<StepPoint | null>(null);
  const [lastStepResult, setLastStepResult] = useState<StepResult | null>(null);
  const [lastStepMetrics, setLastStepMetrics] = useState<{
    processing_time_ms?: number;
    tokens_used?: number;
  } | null>(null);

  // Fetch runtime state
  const { data: runtimeState, refetch: refetchRuntimeState } = useQuery({
    queryKey: ['runtime-state'],
    queryFn: () => cirisClient.system.getRuntimeState(),
    refetchInterval: 2000,
  });

  // Enhanced single-step mutation
  const singleStepMutation = useMutation({
    mutationFn: async (): Promise<EnhancedSingleStepResponse> => {
      return await cirisClient.system.singleStepProcessorEnhanced(true);
    },
    onSuccess: (data) => {
      toast.success(`Step completed: ${data.message}`);
      if (data.step_point) {
        setCurrentStepPoint(data.step_point);
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
      toast.error(`Step failed: ${error.message || 'Unknown error'}`);
    },
  });

  // Runtime control mutations
  const pauseMutation = useMutation({
    mutationFn: () => cirisClient.system.pauseRuntime(),
    onSuccess: () => {
      toast.success('Runtime paused');
      refetchRuntimeState();
    },
    onError: () => {
      toast.error('Failed to pause runtime');
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => cirisClient.system.resumeRuntime(),
    onSuccess: () => {
      toast.success('Runtime resumed');
      setCurrentStepPoint(null);
      setLastStepResult(null);
      setLastStepMetrics(null);
      refetchRuntimeState();
    },
    onError: () => {
      toast.error('Failed to resume runtime');
    },
  });

  // Get step point display names
  const getStepDisplayName = (step: StepPoint): string => {
    const names: Record<StepPoint, string> = {
      [StepPoint.FINALIZE_TASKS_QUEUE]: '1. Finalize Tasks Queue',
      [StepPoint.POPULATE_THOUGHT_QUEUE]: '2. Populate Thought Queue',
      [StepPoint.POPULATE_ROUND]: '3. Populate Round',
      [StepPoint.BUILD_CONTEXT]: '4. Build Context',
      [StepPoint.PERFORM_DMAS]: '5. Perform DMAs',
      [StepPoint.PERFORM_ASPDMA]: '6. Perform ASPDMA',
      [StepPoint.CONSCIENCE_EXECUTION]: '7. Conscience Execution',
      [StepPoint.RECURSIVE_ASPDMA]: '8. Recursive ASPDMA',
      [StepPoint.RECURSIVE_CONSCIENCE]: '9. Recursive Conscience',
      [StepPoint.ACTION_SELECTION]: '10. Action Selection',
      [StepPoint.HANDLER_START]: '11. Handler Start',
      [StepPoint.BUS_OUTBOUND]: '12. Bus Outbound',
      [StepPoint.PACKAGE_HANDLING]: '13. Package Handling',
      [StepPoint.BUS_INBOUND]: '14. Bus Inbound',
      [StepPoint.HANDLER_COMPLETE]: '15. Handler Complete'
    };
    return names[step] || step;
  };

  // Visual step indicators for SVG highlighting
  useEffect(() => {
    if (currentStepPoint) {
      // Add visual highlighting to SVG components based on current step
      // This will be enhanced once we identify specific SVG elements to highlight
      console.log('Current step:', currentStepPoint);
    }
  }, [currentStepPoint]);

  const isPaused = runtimeState?.processor_state === 'paused';
  const isRunning = runtimeState?.processor_state === 'running';

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
                {runtimeState?.processor_state?.toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center space-x-4 mb-6">
            <button
              onClick={() => pauseMutation.mutate()}
              disabled={isPaused || pauseMutation.isPending}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pauseMutation.isPending ? 'Pausing...' : 'Pause'}
            </button>

            <button
              onClick={() => resumeMutation.mutate()}
              disabled={!isPaused || resumeMutation.isPending}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resumeMutation.isPending ? 'Resuming...' : 'Resume'}
            </button>

            <button
              onClick={() => singleStepMutation.mutate()}
              disabled={!isPaused || singleStepMutation.isPending}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {singleStepMutation.isPending ? 'Stepping...' : 'Single Step'}
            </button>
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
                {currentStepPoint ? getStepDisplayName(currentStepPoint) : 'None'}
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

      {/* CIRIS Architecture Diagram */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">CIRIS Architecture Pipeline</h3>
          
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

          {/* Step Indicator Legend */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Pipeline Step Indicators</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
              {Object.values(StepPoint).map((step, index) => (
                <div 
                  key={step}
                  className={`flex items-center space-x-1 px-2 py-1 rounded ${
                    currentStepPoint === step 
                      ? 'bg-blue-200 text-blue-900 font-semibold' 
                      : 'text-blue-700'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span>{getStepDisplayName(step)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Step Details Panel */}
      {lastStepResult && currentStepPoint && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Step Details</h3>
              <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {getStepDisplayName(currentStepPoint)}
              </div>
            </div>
            
            <StepVisualization 
              stepResult={lastStepResult} 
              stepPoint={currentStepPoint} 
            />
          </div>
        </div>
      )}

      {/* Demo Mode Section */}
      {isDemoMode() && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-purple-900">🎭 Demo Mode</h3>
            <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
              Sample Data Active
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => {
                setCurrentStepPoint(StepPoint.FINALIZE_TASKS_QUEUE);
                setLastStepResult(getDemoStepResult(StepPoint.FINALIZE_TASKS_QUEUE));
                setLastStepMetrics({ processing_time_ms: 23, tokens_used: 0 });
                toast.success('Demo: Task Queue Finalization');
              }}
              className="p-4 bg-white rounded-lg border-2 border-purple-200 hover:border-purple-300 text-left"
            >
              <div className="font-medium text-purple-900">1. Task Queue</div>
              <div className="text-sm text-purple-700 mt-1">Show task prioritization</div>
            </button>
            <button
              onClick={() => {
                setCurrentStepPoint(StepPoint.PERFORM_DMAS);
                setLastStepResult(getDemoStepResult(StepPoint.PERFORM_DMAS));
                setLastStepMetrics({ processing_time_ms: 378, tokens_used: 245 });
                toast.success('Demo: Multi-DMA Reasoning');
              }}
              className="p-4 bg-white rounded-lg border-2 border-purple-200 hover:border-purple-300 text-left"
            >
              <div className="font-medium text-purple-900">5. Multi-DMA</div>
              <div className="text-sm text-purple-700 mt-1">Ethical reasoning showcase</div>
            </button>
            <button
              onClick={() => {
                setCurrentStepPoint(StepPoint.CONSCIENCE_EXECUTION);
                setLastStepResult(getDemoStepResult(StepPoint.CONSCIENCE_EXECUTION));
                setLastStepMetrics({ processing_time_ms: 298, tokens_used: 156 });
                toast.success('Demo: Conscience Evaluation');
              }}
              className="p-4 bg-white rounded-lg border-2 border-purple-200 hover:border-purple-300 text-left"
            >
              <div className="font-medium text-purple-900">7. Conscience</div>
              <div className="text-sm text-purple-700 mt-1">Safety validation checks</div>
            </button>
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
                <li><strong>Pause</strong> the runtime to enable step-by-step debugging</li>
                <li><strong>Single Step</strong> executes one pipeline step and shows detailed results</li>
                <li><strong>Resume</strong> continues normal runtime processing</li>
                <li>Visual indicators on the architecture diagram show current processing step</li>
                {isDemoMode() && (
                  <li className="text-purple-700"><strong>Demo Mode:</strong> Add ?demo=true to URL for sample visualizations</li>
                )}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}