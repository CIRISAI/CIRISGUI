'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAgent } from '@/contexts/AgentContextHybrid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cirisClient } from '@/lib/ciris-sdk/client';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { calculateWaterUsage, formatWaterUsage, formatCarbonEmissions, WATER_CALCULATION_EXPLANATION } from '@/lib/environmental-impact';

export default function InteractPage() {
  const { user, hasRole } = useAuth();
  const { currentAgent } = useAgent();
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<'detailed' | 'basic'>('detailed');

  // Track which task_ids belong to messages we sent
  // Use both state (for re-renders) and ref (for latest value in closures)
  const [ourTaskIds, setOurTaskIds] = useState<Set<string>>(new Set());
  const ourTaskIdsRef = useRef<Set<string>>(new Set());

  // Map message_id -> task_id for proper correlation
  const [messageToTaskMap, setMessageToTaskMap] = useState<Map<string, string>>(new Map());
  const messageToTaskMapRef = useRef<Map<string, string>>(new Map());

  // Task-centric state: Map of taskId -> task data
  const [tasks, setTasks] = useState<Map<string, {
    taskId: string;
    description: string;
    color: string;
    completed: boolean;
    firstTimestamp: string; // Timestamp of first event for sorting
    isOurs: boolean; // Is this task from a message we sent?
    thoughts: Array<{
      thoughtId: string;
      stages: Map<string, {
        event_type: string;
        completed: boolean;
        data: any;
      }>;
    }>;
  }>>(new Map());

  const taskColors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500', 'bg-pink-500'];
  const taskColorIndex = useRef(0);

  // Fetch conversation history
  const { data: history, isLoading } = useQuery({
    queryKey: ['conversation-history'],
    queryFn: async () => {
      const result = await cirisClient.agent.getHistory({
        channel_id: 'api_0.0.0.0_8080',
        limit: 20
      });
      return result;
    },
    refetchInterval: 2000,
    enabled: !!currentAgent,
  });

  // Get messages and ensure proper order (oldest to newest)
  const messages = useMemo(() => {
    if (!history?.messages) return [];
    return [...history.messages]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-20);
  }, [history]);

  // Connect to reasoning stream
  useEffect(() => {
    const token = cirisClient.auth.getAccessToken();
    if (!token) {
      console.log('⚠️ No auth token, skipping SSE connection');
      return;
    }
    if (!currentAgent) {
      console.log('⚠️ No current agent, skipping SSE connection');
      return;
    }

    const apiBaseUrl = cirisClient.getBaseURL();
    const streamUrl = `${apiBaseUrl}/v1/system/runtime/reasoning-stream`;

    console.log('🔌 Connecting to SSE stream:', streamUrl);

    const abortController = new AbortController();

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

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        console.log('✅ SSE stream connected');

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is not readable');

        const decoder = new TextDecoder();
        let buffer = '';
        let eventType = '';
        let eventData = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              if (eventType && eventData) {
                processEvent(eventType, eventData);
              }
              eventType = line.slice(6).trim();
              eventData = '';
            } else if (line.startsWith('data:')) {
              const newData = line.slice(5).trim();
              eventData = eventData ? eventData + '\n' + newData : newData;
            } else if (line === '') {
              if (eventType && eventData) {
                processEvent(eventType, eventData);
                eventType = '';
                eventData = '';
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Stream error:', error);
        }
      }
    };

    const processEvent = (eventType: string, eventData: string) => {
      if (eventType === 'step_update') {
        const update = JSON.parse(eventData);
        console.log('📡 Received SSE event:', eventType, 'with', update.events?.length || 0, 'events');
        if (update.events && Array.isArray(update.events)) {
          update.events.forEach((event: any) => {
            const { event_type, thought_id, task_id } = event;
            if (!thought_id || !task_id) return;

            setTasks(prev => {
              const newTasks = new Map(prev);
              let task = newTasks.get(task_id);

              // Create task if it doesn't exist
              if (!task) {
                const isOurs = ourTaskIdsRef.current.has(task_id);
                console.log(`🧠 Creating task ${task_id.slice(-8)}, isOurs: ${isOurs}`);
                console.log(`🧠 Task description:`, event.task_description);

                task = {
                  taskId: task_id,
                  description: event.task_description || '',
                  color: taskColors[taskColorIndex.current % taskColors.length],
                  completed: false,
                  firstTimestamp: event.timestamp || new Date().toISOString(),
                  isOurs: isOurs,
                  thoughts: []
                };
                taskColorIndex.current++;
                newTasks.set(task_id, task);
              }

              console.log(`🎨 Processing ${event_type} for task ${task_id.slice(-8)}, thought ${thought_id.slice(-8)}`);

              // Find or create thought
              let thought = task.thoughts.find(t => t.thoughtId === thought_id);
              if (!thought) {
                thought = {
                  thoughtId: thought_id,
                  stages: new Map()
                };
                task.thoughts.push(thought);
              }

              // Update stage
              thought.stages.set(event_type, {
                event_type,
                completed: true,
                data: event
              });

              // Check if task is complete
              if (event_type === 'action_result' &&
                  (event.action_executed === 'task_complete' || event.action_executed === 'task_reject')) {
                task.completed = true;
              }

              return newTasks;
            });
          });
        }
      }
    };

    connectStream();
    return () => abortController.abort();
  }, [currentAgent]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (msg: string) => {
      return await cirisClient.agent.submitMessage(msg, {
        channel_id: 'api_0.0.0.0_8080',
      });
    },
    onSuccess: (data) => {
      if (data.accepted && data.task_id && data.message_id) {
        // Track this task_id as ours (update both state and ref)
        setOurTaskIds(prev => new Set(prev).add(data.task_id!));
        ourTaskIdsRef.current.add(data.task_id);

        // Map message_id to task_id for correlation
        setMessageToTaskMap(prev => new Map(prev).set(data.message_id, data.task_id!));
        messageToTaskMapRef.current.set(data.message_id, data.task_id);

        console.log('🎯 Tracking our task_id:', data.task_id, 'for message_id:', data.message_id);
        console.log('🎯 ourTaskIdsRef now contains:', Array.from(ourTaskIdsRef.current));

        // Message submitted for async processing
        toast.success(`Message accepted (task: ${data.task_id.slice(-8)})`, { duration: 2000 });
      } else {
        // Message was rejected
        toast.error(`Message rejected: ${data.rejection_reason}`, { duration: 4000 });
        if (data.rejection_detail) {
          console.error('Rejection detail:', data.rejection_detail);
        }
      }

      // Refetch history after a short delay to show user message
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['conversation-history'] });
      }, 500);
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    const msgToSend = message.trim();
    setMessage(''); // Clear immediately
    sendMessageMutation.mutate(msgToSend);
  };

  const stageNames = ['thought_start', 'snapshot_and_context', 'dma_results', 'aspdma_result', 'conscience_result', 'action_result'];

  // Get stage number based on position
  const getStageNumber = (stageName: string): string => {
    const index = stageNames.indexOf(stageName);
    return index >= 0 ? `${index + 1}` : '?';
  };

  // Get action text label
  const getActionLabel = (actionName: string): string => {
    let clean = actionName;
    if (clean?.includes('.')) clean = clean.split('.').pop() || clean;
    return clean.toUpperCase();
  };

  // Check if action is exempt from conscience
  const isConscienceExempt = (actionName: string): boolean => {
    const exemptActions = ['TASK_COMPLETE', 'DEFER', 'REJECT', 'OBSERVE', 'RECALL'];
    let clean = actionName;
    if (clean?.includes('.')) clean = clean.split('.').pop() || clean;
    return exemptActions.includes(clean.toUpperCase());
  };

  // Get conscience status text
  const getConscienceStatus = (consciencePassed: boolean, selectedAction: string): string => {
    if (isConscienceExempt(selectedAction)) {
      return 'EXEMPT';
    }
    return consciencePassed ? 'PASSED' : 'FAILED';
  };

  // Aggregate environmental impact from all thoughts in a task
  const aggregateEnvironmentalImpact = (thoughts: Array<any>) => {
    let totalCarbonGrams = 0;
    let totalEnergyMwh = 0;
    let totalTokens = 0;
    let count = 0;

    thoughts.forEach((thought: any) => {
      const actionStage = thought.stages.get('action_result');
      if (actionStage?.data) {
        const data = actionStage.data;
        if (data.carbon_grams != null) {
          totalCarbonGrams += data.carbon_grams;
          count++;
        }
        if (data.energy_mwh != null) {
          totalEnergyMwh += data.energy_mwh;
        }
        if (data.tokens_total != null) {
          totalTokens += data.tokens_total;
        }
      }
    });

    if (count === 0) return null;

    // Calculate total water usage
    const energyKwh = totalEnergyMwh / 1000000; // Convert mWh (milliwatt-hours) to kWh
    const waterMl = calculateWaterUsage(energyKwh, totalTokens);

    return {
      carbonGrams: totalCarbonGrams,
      waterMl,
      tokens: totalTokens
    };
  };

  // DMA Results Selector Component
  const DMAResultsSelector: React.FC<{
    data: any;
    renderExpandableData: (data: any, depth: number) => React.ReactNode;
    initialSelected?: 'csdma' | 'dsdma' | 'pdma';
  }> = ({ data, renderExpandableData, initialSelected = 'csdma' }) => {
    const [selectedDMA, setSelectedDMA] = useState<'csdma' | 'dsdma' | 'pdma'>(initialSelected);

    const dmaTypes = [
      { key: 'csdma', label: 'Common Sense', icon: 'CS', field: 'csdma' },
      { key: 'dsdma', label: 'Domain Specific', icon: 'DS', field: 'dsdma' },
      { key: 'pdma', label: 'Ethical', icon: 'E', field: 'pdma' }
    ];

    const otherFields = Object.keys(data).filter(
      key => !['csdma', 'dsdma', 'pdma', 'dma_outputs'].includes(key)
    );

    return (
      <div className="space-y-3">
        {/* DMA Type Selector */}
        <div className="flex gap-2">
          {dmaTypes.map(dma => (
            <button
              key={dma.key}
              onClick={() => setSelectedDMA(dma.key as any)}
              className={`flex-1 flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                selectedDMA === dma.key
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 bg-white'
              }`}
            >
              <div className="text-xl font-bold mb-1 text-blue-600">{dma.icon}</div>
              <div className="text-xs font-medium text-center">{dma.label}</div>
            </button>
          ))}
        </div>

        {/* Selected DMA Output */}
        <div className="bg-white border border-gray-200 rounded-lg p-3">
          <div className="text-blue-600 font-semibold mb-2">
            {dmaTypes.find(d => d.key === selectedDMA)?.label} Output:
          </div>
          <div className="ml-2">
            {(() => {
              const dmaOutput = data[dmaTypes.find(d => d.key === selectedDMA)?.field || ''];
              if (dmaOutput && typeof dmaOutput === 'object' && !Array.isArray(dmaOutput)) {
                // Expand object directly
                return (
                  <div className="space-y-1 border-l-2 border-gray-300 pl-2">
                    {Object.entries(dmaOutput).map(([key, value]) => (
                      <div key={key} className="py-1">
                        <span className="text-blue-600 font-medium text-xs mr-2">{key}:</span>
                        {renderExpandableData(value, 2)}
                      </div>
                    ))}
                  </div>
                );
              }
              return renderExpandableData(dmaOutput, 1);
            })()}
          </div>
        </div>

        {/* Other fields under "View details" */}
        {otherFields.length > 0 && (
          <details>
            <summary className="cursor-pointer text-gray-600 hover:bg-gray-100 px-2 py-1 rounded text-xs">
              📋 View details ({otherFields.length} more fields)
            </summary>
            <div className="ml-2 mt-2 space-y-1 border-l-2 border-gray-300 pl-2">
              {otherFields.map(field => (
                <div key={field} className="py-1">
                  <span className="text-blue-600 font-medium text-xs mr-2">{field}:</span>
                  {renderExpandableData(data[field], 2)}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  };

  // Render expandable JSON tree
  const renderExpandableData = (data: any, depth: number = 0): React.ReactNode => {
    if (data === null || data === undefined) {
      return <span className="text-gray-500 italic">null</span>;
    }

    if (typeof data === 'string') {
      // Truncate long strings
      if (data.length > 200) {
        return (
          <details className="inline">
            <summary className="cursor-pointer text-blue-600 hover:underline">
              "{data.substring(0, 100)}..." ({data.length} chars)
            </summary>
            <div className="ml-4 mt-1 text-xs whitespace-pre-wrap break-words">{data}</div>
          </details>
        );
      }
      return <span className="text-green-700">"{data}"</span>;
    }

    if (typeof data === 'number') {
      return <span className="text-purple-600">{data}</span>;
    }

    if (typeof data === 'boolean') {
      return <span className="text-orange-600">{data.toString()}</span>;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return <span className="text-gray-500">[]</span>;
      }
      return (
        <details className="ml-4" open={depth < 1}>
          <summary className="cursor-pointer hover:bg-gray-100 px-1 rounded">
            Array ({data.length} items)
          </summary>
          <div className="ml-4 border-l-2 border-gray-300 pl-2">
            {data.map((item, idx) => (
              <div key={idx} className="py-1">
                <span className="text-gray-500 mr-2">[{idx}]:</span>
                {renderExpandableData(item, depth + 1)}
              </div>
            ))}
          </div>
        </details>
      );
    }

    if (typeof data === 'object') {
      const entries = Object.entries(data);
      if (entries.length === 0) {
        return <span className="text-gray-500">{'{}'}</span>;
      }
      return (
        <details className="ml-4" open={depth < 1}>
          <summary className="cursor-pointer hover:bg-gray-100 px-1 rounded">
            Object ({entries.length} fields)
          </summary>
          <div className="ml-4 border-l-2 border-gray-300 pl-2">
            {entries.map(([key, value]) => (
              <div key={key} className="py-1">
                <span className="text-blue-600 font-medium mr-2">{key}:</span>
                {renderExpandableData(value, depth + 1)}
              </div>
            ))}
          </div>
        </details>
      );
    }

    return <span>{String(data)}</span>;
  };

  // State to track selected DMA for each stage
  const [selectedDMAs, setSelectedDMAs] = useState<Record<string, 'csdma' | 'dsdma' | 'pdma'>>({});

  // Render structured stage data with key fields highlighted
  const renderStageData = (stageName: string, data: any, stageKey?: string): React.ReactNode => {
    // Special rendering for dma_results
    if (stageName === 'dma_results') {
      const initialSelected = stageKey ? selectedDMAs[stageKey] : undefined;
      return <DMAResultsSelector data={data} renderExpandableData={renderExpandableData} initialSelected={initialSelected} />;
    }

    // Special rendering for aspdma_result
    if (stageName === 'aspdma_result') {
      // Extract action name, removing "HandlerActionType." prefix if present
      let selectedAction = data.selected_action || 'UNKNOWN';
      if (selectedAction.includes('.')) {
        selectedAction = selectedAction.split('.').pop() || selectedAction;
      }

      const actionLabel = getActionLabel(selectedAction);
      const actionReasoning = data.action_rationale || data.action_reasoning || '';

      const otherFields = Object.keys(data).filter(
        key => !['selected_action', 'action_rationale', 'action_reasoning'].includes(key)
      );

      return (
        <div className="space-y-3">
          {/* Selected Action */}
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-blue-900 font-bold text-2xl">{actionLabel}</div>
          </div>

          {/* Action Reasoning */}
          <div>
            <div className="text-blue-600 font-semibold mb-2">Reasoning:</div>
            <div className="ml-2 text-gray-700 whitespace-pre-wrap">
              {actionReasoning}
            </div>
          </div>

          {/* Other fields under "View details" */}
          {otherFields.length > 0 && (
            <details>
              <summary className="cursor-pointer text-gray-600 hover:bg-gray-100 px-2 py-1 rounded text-xs">
                📋 View details ({otherFields.length} more fields)
              </summary>
              <div className="ml-2 mt-2 space-y-1 border-l-2 border-gray-300 pl-2">
                {otherFields.map(field => (
                  <div key={field} className="py-1">
                    <span className="text-blue-600 font-medium text-xs mr-2">{field}:</span>
                    {renderExpandableData(data[field], 2)}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      );
    }

    // Special rendering for conscience_result
    if (stageName === 'conscience_result') {
      const consciencePassed = data.conscience_passed;
      const epistemicData = data.epistemic_data || {};
      const overrideReason = data.conscience_override_reason;
      const selectedAction = data.selected_action || '';

      // Determine status: PASSED, FAILED, or EXEMPT
      const conscienceStatus = selectedAction
        ? getConscienceStatus(consciencePassed, selectedAction)
        : (consciencePassed ? 'PASSED' : 'FAILED');

      const isExempt = conscienceStatus === 'EXEMPT';
      const isPassed = conscienceStatus === 'PASSED';

      const entropyLevel = epistemicData.entropy_level ?? null;
      const coherenceLevel = epistemicData.coherence_level ?? null;
      const uncertaintyAcknowledged = epistemicData.uncertainty_acknowledged ?? null;
      const reasoningTransparency = epistemicData.reasoning_transparency ?? null;

      // Check if values meet thresholds
      const entropyOk = entropyLevel !== null && entropyLevel < 0.4;
      const coherenceOk = coherenceLevel !== null && coherenceLevel > 0.6;
      const uncertaintyOk = uncertaintyAcknowledged === true;
      const transparencyOk = reasoningTransparency === 1;

      const otherFields = Object.keys(data).filter(
        key => !['conscience_passed', 'epistemic_data', 'conscience_override_reason', 'selected_action'].includes(key)
      );

      return (
        <div className="space-y-3">
          {/* Conscience Status */}
          <div className={`flex items-center gap-3 border rounded-lg p-3 ${
            isExempt ? 'bg-gray-50 border-gray-300' :
            isPassed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex-1">
              <div className={`font-bold text-2xl ${
                isExempt ? 'text-gray-700' :
                isPassed ? 'text-green-900' : 'text-red-900'
              }`}>
                {conscienceStatus}
              </div>
              {overrideReason && (
                <div className="text-sm text-gray-700 mt-1">Override: {overrideReason}</div>
              )}
            </div>
          </div>

          {/* Epistemic Data */}
          <div>
            <div className="text-blue-600 font-semibold mb-2">Epistemic Values:</div>
            <div className="grid grid-cols-2 gap-2">
              {/* Entropy */}
              <div className={`p-2 rounded border ${entropyOk ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="text-xs font-medium text-gray-600">Entropy Level</div>
                <div className="text-lg font-bold">{entropyLevel !== null ? entropyLevel.toFixed(2) : 'N/A'}</div>
                <div className="text-xs text-gray-500">{entropyOk ? '✓ < 0.4' : '⚠ Must be < 0.4'}</div>
              </div>

              {/* Coherence */}
              <div className={`p-2 rounded border ${coherenceOk ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="text-xs font-medium text-gray-600">Coherence Level</div>
                <div className="text-lg font-bold">{coherenceLevel !== null ? coherenceLevel.toFixed(2) : 'N/A'}</div>
                <div className="text-xs text-gray-500">{coherenceOk ? '✓ > 0.6' : '⚠ Must be > 0.6'}</div>
              </div>

              {/* Uncertainty */}
              <div className={`p-2 rounded border ${uncertaintyOk ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="text-xs font-medium text-gray-600">Uncertainty Acknowledged</div>
                <div className="text-lg font-bold">{uncertaintyAcknowledged !== null ? (uncertaintyAcknowledged ? 'Yes' : 'No') : 'N/A'}</div>
                <div className="text-xs text-gray-500">{uncertaintyOk ? '✓ Acknowledged' : '⚠ Must acknowledge'}</div>
              </div>

              {/* Transparency */}
              <div className={`p-2 rounded border ${transparencyOk ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="text-xs font-medium text-gray-600">Reasoning Transparency</div>
                <div className="text-lg font-bold">{reasoningTransparency !== null ? reasoningTransparency.toFixed(2) : 'N/A'}</div>
                <div className="text-xs text-gray-500">{transparencyOk ? '✓ Maintained' : '⚠ Must maintain'}</div>
              </div>
            </div>
          </div>

          {/* Other fields under "View details" */}
          {otherFields.length > 0 && (
            <details>
              <summary className="cursor-pointer text-gray-600 hover:bg-gray-100 px-2 py-1 rounded text-xs">
                📋 View details ({otherFields.length} more fields)
              </summary>
              <div className="ml-2 mt-2 space-y-1 border-l-2 border-gray-300 pl-2">
                {otherFields.map(field => (
                  <div key={field} className="py-1">
                    <span className="text-blue-600 font-medium text-xs mr-2">{field}:</span>
                    {renderExpandableData(data[field], 2)}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      );
    }

    // Special rendering for action_result
    if (stageName === 'action_result') {
      let actionExecuted = data.action_executed || 'UNKNOWN';
      if (actionExecuted.includes('.')) {
        actionExecuted = actionExecuted.split('.').pop() || actionExecuted;
      }
      const actionLabel = getActionLabel(actionExecuted);

      const executionSuccess = data.execution_success ?? null;
      const auditHash = data.audit_entry_hash || '';
      const hashEnd = auditHash ? auditHash.slice(-8) : '';

      // Environmental impact fields
      const tokensTotal = data.tokens_total ?? null;
      const tokensInput = data.tokens_input ?? null;
      const tokensOutput = data.tokens_output ?? null;
      const carbonGrams = data.carbon_grams ?? null;
      const energyMwh = data.energy_mwh ?? null;

      // Calculate water usage if we have the necessary data
      let waterMl = null;
      if (energyMwh !== null && tokensTotal !== null) {
        const energyKwh = energyMwh / 1000000; // Convert mWh (milliwatt-hours) to kWh
        waterMl = calculateWaterUsage(energyKwh, tokensTotal);
      }

      const hasEnvironmentalData = carbonGrams !== null || waterMl !== null;

      const otherFields = Object.keys(data).filter(
        key => !['action_executed', 'execution_success', 'audit_entry_hash', 'tokens_total', 'tokens_input', 'tokens_output', 'carbon_grams', 'energy_mwh', 'cost_cents'].includes(key)
      );

      return (
        <div className="space-y-3">
          {/* Action Executed */}
          <div className={`flex items-center gap-3 border rounded-lg p-3 ${
            executionSuccess ? 'bg-green-50 border-green-200' : executionSuccess === false ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex-1">
              <div className={`font-bold text-2xl ${
                executionSuccess ? 'text-green-900' : executionSuccess === false ? 'text-red-900' : 'text-gray-900'
              }`}>
                {actionLabel}
              </div>
              {executionSuccess !== null && (
                <div className="text-xs text-gray-600 mt-1">
                  {executionSuccess ? '✓ Executed successfully' : '✗ Execution failed'}
                </div>
              )}
            </div>
          </div>

          {/* Environmental Impact */}
          {hasEnvironmentalData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-green-700 font-semibold text-sm mb-2">Environmental Impact</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {carbonGrams !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Carbon:</span>
                    <span className="font-mono font-medium">{formatCarbonEmissions(carbonGrams)}</span>
                  </div>
                )}
                {waterMl !== null && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Water:</span>
                    <span className="font-mono font-medium">{formatWaterUsage(waterMl)}</span>
                  </div>
                )}
              </div>
              {tokensTotal !== null && (
                <div className="mt-2 pt-2 border-t border-green-200 text-xs text-gray-600">
                  {tokensInput !== null && tokensOutput !== null && (
                    <span>{tokensTotal.toLocaleString()} tokens ({tokensInput.toLocaleString()} in, {tokensOutput.toLocaleString()} out)</span>
                  )}
                  {(tokensInput === null || tokensOutput === null) && (
                    <span>{tokensTotal.toLocaleString()} tokens</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Audit Hash */}
          {auditHash && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="text-blue-600 font-semibold text-sm">HASH TABLE ENTRY</div>
                <div className="font-mono text-xs text-blue-900">...{hashEnd}</div>
              </div>
            </div>
          )}

          {/* Other fields under "View details" */}
          {otherFields.length > 0 && (
            <details>
              <summary className="cursor-pointer text-gray-600 hover:bg-gray-100 px-2 py-1 rounded text-xs">
                View details ({otherFields.length} more fields)
              </summary>
              <div className="ml-2 mt-2 space-y-1 border-l-2 border-gray-300 pl-2">
                {otherFields.map(field => (
                  <div key={field} className="py-1">
                    <span className="text-blue-600 font-medium text-xs mr-2">{field}:</span>
                    {renderExpandableData(data[field], 2)}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      );
    }

    // Define key fields to show for each stage type
    const keyFieldsMap: Record<string, string[]> = {
      'thought_start': ['task_description', 'thought_content'],
      'snapshot_and_context': ['context', 'system_snapshot']
    };

    const keyFields = keyFieldsMap[stageName] || [];
    const otherFields = Object.keys(data).filter(key => !keyFields.includes(key));

    return (
      <div className="space-y-2">
        {/* Key fields */}
        {keyFields.map(field => {
          if (!data[field]) return null;
          const value = data[field];

          return (
            <div key={field} className="py-1">
              <div className="text-blue-600 font-semibold mb-1">{field.replace(/_/g, ' ')}:</div>
              <div className="ml-2">
                {/* Special handling for system_snapshot - expand directly */}
                {field === 'system_snapshot' && typeof value === 'object' ? (
                  <div className="space-y-1 border-l-2 border-gray-300 pl-2">
                    {Object.entries(value).map(([key, val]) => (
                      <div key={key} className="py-1">
                        <span className="text-blue-600 font-medium text-xs mr-2">{key}:</span>
                        {renderExpandableData(val, 2)}
                      </div>
                    ))}
                  </div>
                ) : typeof value === 'string' && value.length > 200 ? (
                  <details>
                    <summary className="cursor-pointer text-gray-700 hover:underline">
                      {value.substring(0, 100)}... ({value.length} chars)
                    </summary>
                    <div className="mt-1 text-xs whitespace-pre-wrap break-words bg-gray-50 p-2 rounded">
                      {value}
                    </div>
                  </details>
                ) : (
                  renderExpandableData(value, 1)
                )}
              </div>
            </div>
          );
        })}

        {/* Other fields under "View details" */}
        {otherFields.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-gray-600 hover:bg-gray-100 px-2 py-1 rounded text-xs">
              📋 View details ({otherFields.length} more fields)
            </summary>
            <div className="ml-2 mt-2 space-y-1 border-l-2 border-gray-300 pl-2">
              {otherFields.map(field => (
                <div key={field} className="py-1">
                  <span className="text-blue-600 font-medium text-xs mr-2">{field}:</span>
                  {renderExpandableData(data[field], 2)}
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    );
  };

  // Load SVG pipeline visualization
  const [svgContent, setSvgContent] = useState<string>('');
  useEffect(() => {
    fetch('/pipeline-visualization.svg')
      .then(res => res.text())
      .then(svg => setSvgContent(svg))
      .catch(err => console.error('Failed to load SVG:', err));
  }, []);

  // Create unified timeline of messages and tasks
  const timeline = useMemo(() => {
    const items: Array<{
      type: 'message' | 'task';
      timestamp: string;
      data: any;
      relatedTask?: any; // For messages, include their related task if it's ours
    }> = [];

    // Add messages with their related tasks
    messages.forEach(msg => {
      // Find if there's a task that belongs to this message using message_id -> task_id mapping
      // The message.id from history matches the message_id we got when submitting
      let relatedTask = undefined;
      if (!msg.is_agent && msg.id) {
        const taskId = messageToTaskMap.get(msg.id);
        if (taskId) {
          relatedTask = tasks.get(taskId);
          console.log('🔗 Matched message', msg.id, 'to task', taskId);
        } else {
          console.log('⚠️ No task mapping for message', msg.id);
        }
      }

      items.push({
        type: 'message',
        timestamp: msg.timestamp,
        data: msg,
        relatedTask
      });
    });

    // Add tasks that are NOT already shown under a message
    // This includes: admin/system tasks (not ours), and our tasks that don't have a message yet
    const shownTaskIds = new Set(items.filter(item => item.relatedTask).map(item => item.relatedTask.taskId));
    Array.from(tasks.values()).forEach(task => {
      if (!shownTaskIds.has(task.taskId)) {
        items.push({
          type: 'task',
          timestamp: task.firstTimestamp,
          data: task
        });
      }
    });

    // Sort by timestamp
    return items.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [messages, tasks, messageToTaskMap]);

  // Auto-scroll to bottom when timeline changes
  useEffect(() => {
    if (timelineContainerRef.current) {
      timelineContainerRef.current.scrollTop = timelineContainerRef.current.scrollHeight;
    }
  }, [timeline]);

  return (
    <ProtectedRoute>
      <style jsx global>{`
        svg {
          max-width: 100%;
          height: auto;
        }
      `}</style>
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-gray-600 max-w-3xl">
              DATUM is a CIRIS Agent demonstrating an ethical AI agent's decision making process. Ask Datum a question about CIRIS or an ethical dilemma, and see the reasoning below. Note the agent may choose not to answer, and your data IS NOT PRIVATE as this is a BETA interface for demonstration and research purposes only.
            </p>

            {/* View Mode Toggle */}
            <div className="flex-shrink-0">
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('basic')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    viewMode === 'basic'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Basic
                </button>
                <button
                  onClick={() => setViewMode('detailed')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    viewMode === 'detailed'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Detailed
                </button>
              </div>
            </div>
          </div>
        </div>

        {currentAgent && (
          <>
            {/* Unified Timeline - Narrower for conversation */}
            <div className="max-w-4xl mx-auto mb-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div ref={timelineContainerRef} className="border rounded-lg bg-gray-50 h-96 overflow-y-auto p-4 mb-4">
                  {isLoading ? (
                    <div className="text-center text-gray-500">Loading conversation...</div>
                  ) : timeline.length === 0 ? (
                    <div className="text-center text-gray-500">No messages yet. Start a conversation!</div>
                  ) : (
                    <div className="space-y-3">
                      {timeline.map((item, i) => {
                        if (item.type === 'message') {
                          const msg = item.data;
                          const task = item.relatedTask;

                          return (
                            <div key={`msg-${msg.id || i}`} className="mb-3">
                              <div className={`${!msg.is_agent ? 'text-right' : 'text-left'}`}>
                                <div className={`inline-block px-4 py-2 rounded ${
                                  !msg.is_agent ? 'bg-blue-500 text-white' : 'bg-gray-200'
                                }`}>
                                  {msg.content}
                                </div>
                                {/* Debug: Show task correlation info for user messages */}
                                {!msg.is_agent && task && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    ✓ Task: {task.taskId.slice(-8)}
                                  </div>
                                )}
                              </div>

                              {/* Show related task if it exists */}
                              {task && !msg.is_agent && (
                                <div className="mt-2 ml-4">
                                  <details className="border rounded-lg">
                                    <summary className={`cursor-pointer p-3 ${task.color} text-white rounded-t-lg ${task.completed ? 'opacity-60' : ''}`}>
                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                          <span className="font-medium text-sm">
                                            🧠 {task.description || task.taskId.slice(-8)}
                                            <span className="ml-2 text-xs opacity-75">[Task: {task.taskId}]</span>
                                          </span>
                                          <span className="text-xs">{task.thoughts.length} thought(s)</span>
                                        </div>
                                        {(() => {
                                          const impact = aggregateEnvironmentalImpact(task.thoughts);
                                          if (!impact) return null;
                                          return (
                                            <div className="flex gap-4 text-xs opacity-90">
                                              <div className="flex items-center gap-1">
                                                <span>Carbon:</span>
                                                <span className="font-mono">{formatCarbonEmissions(impact.carbonGrams)}</span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <span>Water:</span>
                                                <span className="font-mono">{formatWaterUsage(impact.waterMl)}</span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <span>{impact.tokens.toLocaleString()} tokens</span>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    </summary>
                                    <div className="p-3 space-y-2 bg-gray-50">
                                      {task.thoughts.map((thought: any) => {
                                        const thoughtStart = thought.stages.get('thought_start');
                                        const thoughtContent = thoughtStart?.data?.thought_content || 'Processing thought...';
                                        const truncated = thoughtContent.length > 80
                                          ? thoughtContent.substring(0, 80) + '...'
                                          : thoughtContent;

                                        if (viewMode === 'basic') {
                                          // Basic mode: show compact key stages (DMA, Action, Conscience, Final Action)
                                          const dmaStage = thought.stages.get('dma_results');
                                          const aspdmaStage = thought.stages.get('aspdma_result');
                                          const conscienceStage = thought.stages.get('conscience_result');
                                          const actionStage = thought.stages.get('action_result');

                                          // Check if there's recursion (stages will be repeated)
                                          const hasRecursion = aspdmaStage?.data?.is_recursive || conscienceStage?.data?.is_recursive;

                                          return (
                                            <div key={thought.thoughtId} className="border border-gray-200 rounded p-2 bg-white space-y-1">
                                              {/* Thought summary */}
                                              <div className="text-sm font-medium mb-2">{truncated}</div>

                                              {/* Compact stage indicators */}
                                              <div className="flex flex-wrap gap-1 items-center text-xs">
                                                {/* DMA indicators */}
                                                {dmaStage && (
                                                  <span className="px-1.5 py-0.5 bg-gray-100 rounded font-bold" title="DMAs">
                                                    CS·DS·E
                                                  </span>
                                                )}

                                                {/* First pass: Selected Action */}
                                                {aspdmaStage?.data?.selected_action && (
                                                  <>
                                                    <span className="text-gray-400">→</span>
                                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">
                                                      {getActionLabel(aspdmaStage.data.selected_action)}
                                                    </span>
                                                  </>
                                                )}

                                                {/* First pass: Conscience Status */}
                                                {conscienceStage && aspdmaStage?.data?.selected_action && (
                                                  <>
                                                    <span className="text-gray-400">→</span>
                                                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                                                      getConscienceStatus(conscienceStage.data.conscience_passed, aspdmaStage.data.selected_action) === 'EXEMPT'
                                                        ? 'bg-gray-100 text-gray-700'
                                                        : conscienceStage.data.conscience_passed
                                                          ? 'bg-green-100 text-green-800'
                                                          : 'bg-red-100 text-red-800'
                                                    }`}>
                                                      {getConscienceStatus(conscienceStage.data.conscience_passed, aspdmaStage.data.selected_action)}
                                                    </span>
                                                  </>
                                                )}

                                                {/* Second pass (recursive): Action and Conscience */}
                                                {hasRecursion && aspdmaStage?.data?.selected_action && (
                                                  <>
                                                    <span className="text-gray-400">→</span>
                                                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold opacity-75" title="Recursive">
                                                      {getActionLabel(aspdmaStage.data.selected_action)}
                                                    </span>
                                                    <span className="text-gray-400">→</span>
                                                    <span className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded font-bold opacity-75" title="Recursive">
                                                      PASSED
                                                    </span>
                                                  </>
                                                )}

                                                {/* Final executed action */}
                                                {actionStage?.data?.action_executed && (
                                                  <>
                                                    <span className="text-gray-400">→</span>
                                                    <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-bold" title="Executed">
                                                      {getActionLabel(actionStage.data.action_executed)}
                                                    </span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        }

                                        // Detailed mode: show expandable stages
                                        return (
                                          <details key={thought.thoughtId} className="border border-gray-200 rounded">
                                            <summary className="cursor-pointer p-2 bg-white hover:bg-gray-50">
                                              <span className="text-sm font-medium">{truncated}</span>
                                              <span className="text-xs text-gray-500 ml-2">
                                                ({thought.stages.size}/6 stages)
                                              </span>
                                            </summary>
                                            <div className="p-2 bg-gray-100 space-y-1">
                                              {/* H3ERE Stages */}
                                              {stageNames.map(stageName => {
                                              const stage = thought.stages.get(stageName);
                                              if (!stage) {
                                                return (
                                                  <div
                                                    key={stageName}
                                                    className="flex items-center p-2 rounded text-xs bg-gray-200"
                                                  >
                                                    <span className="mr-2 font-bold text-gray-600">{getStageNumber(stageName)}</span>
                                                    <span className="text-gray-500">
                                                      {stageName.replace(/_/g, ' ').toUpperCase()}
                                                    </span>
                                                  </div>
                                                );
                                              }

                                              const timestamp = stage.data.timestamp
                                                ? new Date(stage.data.timestamp).toLocaleTimeString('en-US', {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    second: '2-digit',
                                                    fractionalSecondDigits: 3
                                                  })
                                                : '';


                                              return (
                                                <details key={stageName} className="bg-green-50 border border-green-200 rounded">
                                                  <summary className="flex items-center p-2 cursor-pointer hover:bg-green-100 rounded text-xs">
                                                    <span className="mr-2 font-bold text-green-700">{getStageNumber(stageName)}</span>
                                                    <span className="font-medium flex-1">
                                                      {stageName.replace(/_/g, ' ').toUpperCase()}
                                                    </span>
                                                    {timestamp && (
                                                      <span className="text-gray-500 text-xs mr-2">{timestamp}</span>
                                                    )}
                                                    {/* Show DMA icons for dma_results stage */}
                                                    {stageName === 'dma_results' && (
                                                      <span className="flex gap-1 mr-2">
                                                        <span
                                                          title="Common Sense DMA"
                                                          className="cursor-pointer hover:bg-green-200 transition-colors px-1.5 py-0.5 rounded text-xs font-bold"
                                                          onClick={(e) => {
                                                            const details = e.currentTarget.closest('details');
                                                            if (details?.open) {
                                                              // Already open, just switch DMA (prevent toggle)
                                                              e.stopPropagation();
                                                            }
                                                            // Let it expand naturally if closed
                                                            setSelectedDMAs(prev => ({ ...prev, [`thought-${thought.thoughtId}-dma`]: 'csdma' }));
                                                          }}
                                                        >CS</span>
                                                        <span
                                                          title="Domain Specific DMA"
                                                          className="cursor-pointer hover:bg-green-200 transition-colors px-1.5 py-0.5 rounded text-xs font-bold"
                                                          onClick={(e) => {
                                                            const details = e.currentTarget.closest('details');
                                                            if (details?.open) {
                                                              // Already open, just switch DMA (prevent toggle)
                                                              e.stopPropagation();
                                                            }
                                                            // Let it expand naturally if closed
                                                            setSelectedDMAs(prev => ({ ...prev, [`thought-${thought.thoughtId}-dma`]: 'dsdma' }));
                                                          }}
                                                        >DS</span>
                                                        <span
                                                          title="Ethical DMA"
                                                          className="cursor-pointer hover:bg-green-200 transition-colors px-1.5 py-0.5 rounded text-xs font-bold"
                                                          onClick={(e) => {
                                                            const details = e.currentTarget.closest('details');
                                                            if (details?.open) {
                                                              // Already open, just switch DMA (prevent toggle)
                                                              e.stopPropagation();
                                                            }
                                                            // Let it expand naturally if closed
                                                            setSelectedDMAs(prev => ({ ...prev, [`thought-${thought.thoughtId}-dma`]: 'pdma' }));
                                                          }}
                                                        >E</span>
                                                      </span>
                                                    )}
                                                    {/* Show action label for ASPDMA */}
                                                    {stageName === 'aspdma_result' && stage.data.selected_action && (
                                                      <span className="mr-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold" title={`Action: ${stage.data.selected_action}`}>
                                                        {getActionLabel(stage.data.selected_action)}
                                                        {stage.data.is_recursive && <span className="ml-1" title="Recursive">🔁</span>}
                                                      </span>
                                                    )}
                                                    {/* Show conscience status */}
                                                    {stageName === 'conscience_result' && (
                                                      <span className={`mr-2 px-1.5 py-0.5 rounded text-xs font-bold ${
                                                        getConscienceStatus(stage.data.conscience_passed, stage.data.selected_action || '') === 'EXEMPT'
                                                          ? 'bg-gray-100 text-gray-700'
                                                          : stage.data.conscience_passed
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-red-100 text-red-800'
                                                      }`}>
                                                        {getConscienceStatus(stage.data.conscience_passed, stage.data.selected_action || '')}
                                                        {stage.data.is_recursive && <span className="ml-1" title="Recursive">🔁</span>}
                                                      </span>
                                                    )}
                                                    {/* Show action label for ACTION RESULT */}
                                                    {stageName === 'action_result' && stage.data.action_executed && (
                                                      <span className="mr-2 px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-bold" title={`Executed: ${stage.data.action_executed}`}>
                                                        {getActionLabel(stage.data.action_executed)}
                                                      </span>
                                                    )}
                                                    <span className="text-green-600">✓</span>
                                                  </summary>
                                                  <div className="p-2 bg-white border-t border-green-200 text-xs">
                                                    {renderStageData(stageName, stage.data, `thought-${thought.thoughtId}-dma`)}
                                                  </div>
                                                </details>
                                              );
                                            })}
                                          </div>
                                        </details>
                                        );
                                      })}
                                    </div>
                                  </details>
                                </div>
                              )}
                            </div>
                          );
                        } else {
                          // Task item
                          const task = item.data;
                          return (
                            <details key={`task-${task.taskId}`} className="border rounded-lg">
                              <summary className={`cursor-pointer p-3 ${task.color} text-white rounded-t-lg ${task.completed ? 'opacity-60' : ''}`}>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium">{task.description || task.taskId.slice(-8)}</span>
                                    <span className="text-xs">{task.thoughts.length} thought(s)</span>
                                  </div>
                                  {(() => {
                                    const impact = aggregateEnvironmentalImpact(task.thoughts);
                                    if (!impact) return null;
                                    return (
                                      <div className="flex gap-4 text-xs opacity-90">
                                        <div className="flex items-center gap-1">
                                          <span>Carbon:</span>
                                          <span className="font-mono">{formatCarbonEmissions(impact.carbonGrams)}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span>Water:</span>
                                          <span className="font-mono">{formatWaterUsage(impact.waterMl)}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <span>{impact.tokens.toLocaleString()} tokens</span>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </summary>
                              <div className="p-3 space-y-2 bg-gray-50">
                                {task.thoughts.map((thought: any) => {
                                  const thoughtStart = thought.stages.get('thought_start');
                                  const thoughtContent = thoughtStart?.data?.thought_content || 'Processing thought...';
                                  const truncated = thoughtContent.length > 80
                                    ? thoughtContent.substring(0, 80) + '...'
                                    : thoughtContent;

                                  if (viewMode === 'basic') {
                                    // Basic mode: show compact key stages (DMA, Action, Conscience, Final Action)
                                    const dmaStage = thought.stages.get('dma_results');
                                    const aspdmaStage = thought.stages.get('aspdma_result');
                                    const conscienceStage = thought.stages.get('conscience_result');
                                    const actionStage = thought.stages.get('action_result');

                                    // Check if there's recursion (stages will be repeated)
                                    const hasRecursion = aspdmaStage?.data?.is_recursive || conscienceStage?.data?.is_recursive;

                                    return (
                                      <div key={thought.thoughtId} className="border border-gray-200 rounded p-2 bg-white space-y-1">
                                        {/* Thought summary */}
                                        <div className="text-sm font-medium mb-2">{truncated}</div>

                                        {/* Compact stage indicators */}
                                        <div className="flex flex-wrap gap-1 items-center text-xs">
                                          {/* DMA indicators */}
                                          {dmaStage && (
                                            <span className="px-1.5 py-0.5 bg-gray-100 rounded font-bold" title="DMAs">
                                              CS·DS·E
                                            </span>
                                          )}

                                          {/* First pass: Selected Action */}
                                          {aspdmaStage?.data?.selected_action && (
                                            <>
                                              <span className="text-gray-400">→</span>
                                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">
                                                {getActionLabel(aspdmaStage.data.selected_action)}
                                              </span>
                                            </>
                                          )}

                                          {/* First pass: Conscience Status */}
                                          {conscienceStage && aspdmaStage?.data?.selected_action && (
                                            <>
                                              <span className="text-gray-400">→</span>
                                              <span className={`px-1.5 py-0.5 rounded font-bold ${
                                                getConscienceStatus(conscienceStage.data.conscience_passed, aspdmaStage.data.selected_action) === 'EXEMPT'
                                                  ? 'bg-gray-100 text-gray-700'
                                                  : conscienceStage.data.conscience_passed
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                              }`}>
                                                {getConscienceStatus(conscienceStage.data.conscience_passed, aspdmaStage.data.selected_action)}
                                              </span>
                                            </>
                                          )}

                                          {/* Second pass (recursive): Action and Conscience */}
                                          {hasRecursion && aspdmaStage?.data?.selected_action && (
                                            <>
                                              <span className="text-gray-400">→</span>
                                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold opacity-75" title="Recursive">
                                                {getActionLabel(aspdmaStage.data.selected_action)}
                                              </span>
                                              <span className="text-gray-400">→</span>
                                              <span className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded font-bold opacity-75" title="Recursive">
                                                PASSED
                                              </span>
                                            </>
                                          )}

                                          {/* Final executed action */}
                                          {actionStage?.data?.action_executed && (
                                            <>
                                              <span className="text-gray-400">→</span>
                                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded font-bold" title="Executed">
                                                {getActionLabel(actionStage.data.action_executed)}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }

                                  // Detailed mode: show expandable stages
                                  return (
                                    <details key={thought.thoughtId} className="border border-gray-200 rounded">
                                      <summary className="cursor-pointer p-2 bg-white hover:bg-gray-50">
                                        <span className="text-sm font-medium">{truncated}</span>
                                        <span className="text-xs text-gray-500 ml-2">
                                          ({thought.stages.size}/6 stages)
                                        </span>
                                      </summary>
                                      <div className="p-2 bg-gray-100 space-y-1">
                                        {/* H3ERE Stages */}
                                        {stageNames.map(stageName => {
                                        const stage = thought.stages.get(stageName);
                                        if (!stage) {
                                          return (
                                            <div
                                              key={stageName}
                                              className="flex items-center p-2 rounded text-xs bg-gray-200"
                                            >
                                              <span className="mr-2 font-bold text-gray-600">{getStageNumber(stageName)}</span>
                                              <span className="text-gray-500">
                                                {stageName.replace(/_/g, ' ').toUpperCase()}
                                              </span>
                                            </div>
                                          );
                                        }

                                        // Format timestamp for display
                                        const timestamp = stage.data.timestamp
                                          ? new Date(stage.data.timestamp).toLocaleTimeString('en-US', {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                              second: '2-digit',
                                              fractionalSecondDigits: 3
                                            })
                                          : '';


                                        return (
                                          <details key={stageName} className="bg-green-50 border border-green-200 rounded">
                                            <summary className="flex items-center p-2 cursor-pointer hover:bg-green-100 rounded text-xs">
                                              <span className="mr-2 font-bold text-green-700">{getStageNumber(stageName)}</span>
                                              <span className="font-medium flex-1">
                                                {stageName.replace(/_/g, ' ').toUpperCase()}
                                              </span>
                                              {timestamp && (
                                                <span className="text-gray-500 text-xs mr-2">{timestamp}</span>
                                              )}
                                              {/* Show DMA icons for dma_results stage */}
                                              {stageName === 'dma_results' && (
                                                <span className="flex gap-1 mr-2">
                                                  <span
                                                    title="Common Sense DMA"
                                                    className="cursor-pointer hover:bg-green-200 transition-colors px-1.5 py-0.5 rounded text-xs font-bold"
                                                    onClick={(e) => {
                                                      const details = e.currentTarget.closest('details');
                                                      if (details?.open) {
                                                        // Already open, just switch DMA (prevent toggle)
                                                        e.stopPropagation();
                                                      }
                                                      // Let it expand naturally if closed
                                                      setSelectedDMAs(prev => ({ ...prev, [`thought-${thought.thoughtId}-dma`]: 'csdma' }));
                                                    }}
                                                  >CS</span>
                                                  <span
                                                    title="Domain Specific DMA"
                                                    className="cursor-pointer hover:bg-green-200 transition-colors px-1.5 py-0.5 rounded text-xs font-bold"
                                                    onClick={(e) => {
                                                      const details = e.currentTarget.closest('details');
                                                      if (details?.open) {
                                                        // Already open, just switch DMA (prevent toggle)
                                                        e.stopPropagation();
                                                      }
                                                      // Let it expand naturally if closed
                                                      setSelectedDMAs(prev => ({ ...prev, [`thought-${thought.thoughtId}-dma`]: 'dsdma' }));
                                                    }}
                                                  >DS</span>
                                                  <span
                                                    title="Ethical DMA"
                                                    className="cursor-pointer hover:bg-green-200 transition-colors px-1.5 py-0.5 rounded text-xs font-bold"
                                                    onClick={(e) => {
                                                      const details = e.currentTarget.closest('details');
                                                      if (details?.open) {
                                                        // Already open, just switch DMA (prevent toggle)
                                                        e.stopPropagation();
                                                      }
                                                      // Let it expand naturally if closed
                                                      setSelectedDMAs(prev => ({ ...prev, [`thought-${thought.thoughtId}-dma`]: 'pdma' }));
                                                    }}
                                                  >E</span>
                                                </span>
                                              )}
                                              {/* Show action label for ASPDMA */}
                                              {stageName === 'aspdma_result' && stage.data.selected_action && (
                                                <span className="mr-2 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-bold" title={`Action: ${stage.data.selected_action}`}>
                                                  {getActionLabel(stage.data.selected_action)}
                                                  {stage.data.is_recursive && <span className="ml-1" title="Recursive">🔁</span>}
                                                </span>
                                              )}
                                              {/* Show conscience status */}
                                              {stageName === 'conscience_result' && (
                                                <span className={`mr-2 px-1.5 py-0.5 rounded text-xs font-bold ${
                                                  getConscienceStatus(stage.data.conscience_passed, stage.data.selected_action || '') === 'EXEMPT'
                                                    ? 'bg-gray-100 text-gray-700'
                                                    : stage.data.conscience_passed
                                                      ? 'bg-green-100 text-green-800'
                                                      : 'bg-red-100 text-red-800'
                                                }`}>
                                                  {getConscienceStatus(stage.data.conscience_passed, stage.data.selected_action || '')}
                                                  {stage.data.is_recursive && <span className="ml-1" title="Recursive">🔁</span>}
                                                </span>
                                              )}
                                              {/* Show action label for ACTION RESULT */}
                                              {stageName === 'action_result' && stage.data.action_executed && (
                                                <span className="mr-2 px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-bold" title={`Executed: ${stage.data.action_executed}`}>
                                                  {getActionLabel(stage.data.action_executed)}
                                                </span>
                                              )}
                                              <span className="text-green-600">✓</span>
                                            </summary>
                                            <div className="p-2 bg-white border-t border-green-200 text-xs">
                                              {renderStageData(stageName, stage.data, `thought-${thought.thoughtId}-dma`)}
                                            </div>
                                          </details>
                                        );
                                      })}
                                    </div>
                                  </details>
                                  );
                                })}
                              </div>
                            </details>
                          );
                        }
                      })}
                    </div>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={sendMessageMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
            </div>

            {/* Full-width visualizations container */}
            <div className="max-w-7xl mx-auto space-y-6">
            {/* Pipeline Visualization */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Detailed view of the CIRIS reasoning and machine conscience pipeline</h3>
                <p className="text-sm text-gray-600 mb-4">
                  This diagram shows the complete CIRIS Agent pipeline that processes each thought through context gathering and then multiple stages of analysis, including what COULD and SHOULD be done from 3 different perspectives simultaneously, principled action selection from 10 verbs, and conscience evaluation of whether this action aligns with CIRIS principles and the agents own identity and past actions.
                </p>
                <div className="w-full bg-gray-50 rounded-lg p-4">
                  {svgContent ? (
                    <div className="w-full" style={{ maxWidth: '100%', overflow: 'visible' }}>
                      <div dangerouslySetInnerHTML={{ __html: svgContent }} style={{ width: '100%', height: 'auto' }} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[150px] text-gray-500">
                      Loading pipeline visualization...
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Environmental Impact Explanation */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Environmental Impact Calculation</h3>
                <div className="text-sm text-gray-600 space-y-3 prose prose-sm max-w-none">
                  <p>
                    Water consumption is estimated using a hybrid approach combining two peer-reviewed methodologies:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 ml-2">
                    <li>
                      <strong>WUE-Based Calculation:</strong> Uses Water Usage Effectiveness (WUE) metrics for Illinois-hosted data centers.
                      We assume 1.5 L/kWh based on Midwest climate conditions and evaporative cooling systems (between industry
                      average of 1.8 L/kWh and best-in-class of 0.3 L/kWh).
                    </li>
                    <li>
                      <strong>Per-Token Estimation:</strong> Based on a November 2024 study published in <em>Nature Scientific Reports</em> examining
                      Meta's Llama-3-70B model, which found approximately 0.4 ml of water consumption per token (including both
                      operational and embodied environmental footprints). This is adjusted proportionally for the Llama-4-Maverick-17B
                      model (17B/70B = ~0.097 ml/token).
                    </li>
                  </ol>
                  <p>
                    The final estimate is the average of both methods to provide a defensible, conservative estimate. Water usage
                    includes both direct cooling water consumption and indirect water footprint from electricity generation.
                  </p>
                  <p>
                    <strong>Carbon Emissions:</strong> Calculated based on the energy consumption of the inference request and the carbon intensity
                    of the electrical grid serving the data center.
                  </p>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      <strong>Data Sources:</strong> Nature Scientific Reports (2024): "Reconciling the contrasting narratives on the environmental impact of large language models";
                      ISO/IEC 30134-9 WUE Standard; Regional data center efficiency benchmarks (AWS, Microsoft, Equinix)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
