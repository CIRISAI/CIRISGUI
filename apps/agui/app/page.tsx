'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAgent } from '@/contexts/AgentContextHybrid';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cirisClient } from '@/lib/ciris-sdk/client';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function InteractPage() {
  const { user, hasRole } = useAuth();
  const { currentAgent } = useAgent();
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const timelineContainerRef = useRef<HTMLDivElement>(null);

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

  const stageIcons: Record<string, string> = {
    'thought_start': '🎬',
    'snapshot_and_context': '📸',
    'dma_results': '🧠',
    'aspdma_result': '🎯',
    'conscience_result': '✅',
    'action_result': '⚡'
  };

  const stageNames = ['thought_start', 'snapshot_and_context', 'dma_results', 'aspdma_result', 'conscience_result', 'action_result'];

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

  // Render structured stage data with key fields highlighted
  const renderStageData = (stageName: string, data: any): React.ReactNode => {
    // Special rendering for dma_results
    if (stageName === 'dma_results') {
      const [selectedDMA, setSelectedDMA] = useState<'csdma' | 'dsdma' | 'pdma'>('csdma');

      const dmaTypes = [
        { key: 'csdma', label: 'Common Sense', icon: '🧠', field: 'csdma_output' },
        { key: 'dsdma', label: 'Domain Specific', icon: '🎯', field: 'dsdma_output' },
        { key: 'pdma', label: 'Ethical', icon: '⚖️', field: 'pdma_output' }
      ];

      const otherFields = Object.keys(data).filter(
        key => !['csdma_output', 'dsdma_output', 'pdma_output', 'dma_outputs'].includes(key)
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
                <div className="text-2xl mb-1">{dma.icon}</div>
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
              {renderExpandableData(data[dmaTypes.find(d => d.key === selectedDMA)?.field || ''], 1)}
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

    // Define key fields to show for each stage type
    const keyFieldsMap: Record<string, string[]> = {
      'thought_start': ['task_description', 'thought_content'],
      'snapshot_and_context': ['context', 'system_snapshot'],
      'aspdma_result': ['selected_action', 'action_reasoning', 'all_actions'],
      'conscience_result': ['conscience_decision', 'conscience_reasoning', 'conscience_score'],
      'action_result': ['action_executed', 'action_result', 'action_output']
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
                {typeof value === 'string' && value.length > 200 ? (
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

  // Fetch memory visualization
  const { data: memorySvgContent } = useQuery<string>({
    queryKey: ['memory-visualization-interact'],
    queryFn: async () => {
      const svg = await cirisClient.memory.getVisualization({
        scope: 'local',
        layout: 'timeline',
        hours: 168,
        width: 1200,
        height: 600,
        limit: 1000,
        include_metrics: false
      });

      // Strip out the embedded title/metadata text elements from the SVG
      // The backend includes "Memory Graph Visualization", "Time Range", etc.
      return svg.replace(/<text[^>]*>(Memory Graph Visualization|Time Range:|Nodes:|Layout:)[^<]*<\/text>/gi, '');
    },
    enabled: !!currentAgent,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

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
          <p className="text-sm text-gray-600 max-w-3xl">
            DATUM is a CIRIS Agent demonstrating an ethical AI agent's decision making process. Ask Datum a question about CIRIS or an ethical dilemma, and see the reasoning below. Note the agent may choose not to answer, and your data IS NOT PRIVATE as this is a BETA interface for demonstration and research purposes only.
          </p>
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
                                      <div className="flex justify-between items-center">
                                        <span className="font-medium text-sm">
                                          🧠 {task.description || task.taskId.slice(-8)}
                                          <span className="ml-2 text-xs opacity-75">[Task: {task.taskId}]</span>
                                        </span>
                                        <span className="text-xs">{task.thoughts.length} thought(s)</span>
                                      </div>
                                    </summary>
                                    <div className="p-3 space-y-2 bg-gray-50">
                                      {task.thoughts.map((thought: any) => (
                                        <details key={thought.thoughtId} className="border border-gray-200 rounded">
                                          <summary className="cursor-pointer p-2 bg-white hover:bg-gray-50">
                                            <span className="text-sm font-medium">Thought {thought.thoughtId.slice(-8)}</span>
                                            <span className="text-xs text-gray-500 ml-2">
                                              ({thought.stages.size}/6 stages)
                                            </span>
                                          </summary>
                                          <div className="p-2 bg-gray-100 space-y-1">
                                            {/* H3ERE Stages - Copy the stage rendering code here */}
                                            {stageNames.map(stageName => {
                                              const stage = thought.stages.get(stageName);
                                              if (!stage) {
                                                return (
                                                  <div
                                                    key={stageName}
                                                    className="flex items-center p-2 rounded text-xs bg-gray-200"
                                                  >
                                                    <span className="mr-2">{stageIcons[stageName]}</span>
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
                                                    <span className="mr-2">{stageIcons[stageName]}</span>
                                                    <span className="font-medium flex-1">
                                                      {stageName.replace(/_/g, ' ').toUpperCase()}
                                                    </span>
                                                    {timestamp && (
                                                      <span className="text-gray-500 text-xs mr-2">{timestamp}</span>
                                                    )}
                                                    <span className="text-green-600">✓</span>
                                                  </summary>
                                                  <div className="p-2 bg-white border-t border-green-200 text-xs">
                                                    {renderStageData(stageName, stage.data)}
                                                  </div>
                                                </details>
                                              );
                                            })}
                                          </div>
                                        </details>
                                      ))}
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
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{task.description || task.taskId.slice(-8)}</span>
                                  <span className="text-xs">{task.thoughts.length} thought(s)</span>
                                </div>
                              </summary>
                              <div className="p-3 space-y-2 bg-gray-50">
                                {task.thoughts.map((thought: any) => (
                                  <details key={thought.thoughtId} className="border border-gray-200 rounded">
                                    <summary className="cursor-pointer p-2 bg-white hover:bg-gray-50">
                                      <span className="text-sm font-medium">Thought {thought.thoughtId.slice(-8)}</span>
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
                                              <span className="mr-2">{stageIcons[stageName]}</span>
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
                                              <span className="mr-2">{stageIcons[stageName]}</span>
                                              <span className="font-medium flex-1">
                                                {stageName.replace(/_/g, ' ').toUpperCase()}
                                              </span>
                                              {timestamp && (
                                                <span className="text-gray-500 text-xs mr-2">{timestamp}</span>
                                              )}
                                              <span className="text-green-600">✓</span>
                                            </summary>
                                            <div className="p-2 bg-white border-t border-green-200 text-xs">
                                              {renderStageData(stageName, stage.data)}
                                            </div>
                                          </details>
                                        );
                                      })}
                                    </div>
                                  </details>
                                ))}
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

            {/* Memory Visualization */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Snapshot of the CIRIS Agent Memory</h3>
              <p className="text-sm text-gray-600 mb-4">
                Real-time view of the agent's memory graph showing concepts, observations, and relationships formed over the past week.
              </p>
              {memorySvgContent ? (
                <div className="w-full overflow-x-auto">
                  <div
                    dangerouslySetInnerHTML={{ __html: memorySvgContent }}
                    className="[&>svg]:max-w-full [&>svg]:h-auto [&>svg]:w-full"
                    style={{ minHeight: '300px' }}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-[150px] text-gray-500">
                  Loading memory visualization...
                </div>
              )}
            </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
