'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAgent } from '@/contexts/AgentContextHybrid';
import { useMutation } from '@tanstack/react-query';
import { cirisClient } from '@/lib/ciris-sdk/client';
import toast from 'react-hot-toast';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function Interact2Page() {
  const { user, hasRole } = useAuth();
  const { currentAgent } = useAgent();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);

  // Task-centric state: Map of taskId -> task data
  const [tasks, setTasks] = useState<Map<string, {
    taskId: string;
    description: string;
    color: string;
    completed: boolean;
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

  // Connect to reasoning stream
  useEffect(() => {
    const token = cirisClient.auth.getAccessToken();
    if (!token) return;

    const apiBaseUrl = cirisClient.getBaseURL();
    const streamUrl = `${apiBaseUrl}/v1/system/runtime/reasoning-stream`;

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
        if (update.events && Array.isArray(update.events)) {
          update.events.forEach((event: any) => {
            const { event_type, thought_id, task_id } = event;
            if (!thought_id || !task_id) return;

            setTasks(prev => {
              const newTasks = new Map(prev);
              let task = newTasks.get(task_id);

              // Create task if it doesn't exist
              if (!task) {
                task = {
                  taskId: task_id,
                  description: event.task_description || '',
                  color: taskColors[taskColorIndex.current % taskColors.length],
                  completed: false,
                  thoughts: []
                };
                taskColorIndex.current++;
                newTasks.set(task_id, task);
              }

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
      return await cirisClient.agent.interact(msg, {
        channel_id: 'web_ui',
      });
    },
    onSuccess: (data) => {
      setMessages(prev => [...prev,
        { role: 'user', content: message },
        { role: 'assistant', content: data.response || 'Processing...' }
      ]);
      setMessage('');
    },
    onError: (error: any) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
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

  return (
    <ProtectedRoute>
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 max-w-7xl mx-auto">
          <p className="text-sm text-gray-600 max-w-md">
            Alternative task-centric view: Tasks expand to show thoughts, thoughts show H3ERE stages
          </p>
        </div>

        {currentAgent && (
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chat Interface - Left Column */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="border rounded-lg bg-gray-50 h-96 overflow-y-auto p-4 mb-4">
                  {messages.map((msg, i) => (
                    <div key={i} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                      <div className={`inline-block px-4 py-2 rounded ${
                        msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
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

            {/* Task List - Right Column */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium mb-4">Active Tasks</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {Array.from(tasks.values()).map(task => (
                    <details key={task.taskId} className="border rounded-lg">
                      <summary className={`cursor-pointer p-3 ${task.color} text-white rounded-t-lg ${task.completed ? 'opacity-60' : ''}`}>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{task.description || task.taskId.slice(-8)}</span>
                          <span className="text-xs">{task.thoughts.length} thought(s)</span>
                        </div>
                      </summary>
                      <div className="p-3 space-y-2 bg-gray-50">
                        {task.thoughts.map(thought => (
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
                                return (
                                  <div
                                    key={stageName}
                                    className={`flex items-center p-2 rounded text-xs ${
                                      stage ? 'bg-green-50 border border-green-200' : 'bg-gray-200'
                                    }`}
                                  >
                                    <span className="mr-2">{stageIcons[stageName]}</span>
                                    <span className={stage ? 'font-medium' : 'text-gray-500'}>
                                      {stageName.replace(/_/g, ' ').toUpperCase()}
                                    </span>
                                    {stage && <span className="ml-auto text-green-600">✓</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
