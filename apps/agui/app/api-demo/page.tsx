'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { cirisClient } from '../../lib/ciris-sdk';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import toast from 'react-hot-toast';
import { SpinnerIcon } from '../../components/Icons';

interface DemoSection {
  title: string;
  description: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  execute: () => Promise<any>;
  params?: any;
}

export default function ApiDemoPage() {
  const [selectedDemo, setSelectedDemo] = useState<DemoSection | null>(null);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<keyof typeof demoCategories>('agent');

  const demoCategories: Record<string, { title: string; demos: DemoSection[] }> = {
    agent: {
      title: 'Agent Interaction',
      demos: [
        {
          title: 'Get Agent Status',
          description: 'Retrieve current agent status and cognitive state',
          endpoint: 'GET /v1/agent/status',
          method: 'GET' as const,
          execute: () => cirisClient.agent.getStatus()
        },
        {
          title: 'Get Agent Identity',
          description: 'Get agent identity, name, and capabilities',
          endpoint: 'GET /v1/agent/identity',
          method: 'GET' as const,
          execute: () => cirisClient.agent.getIdentity()
        },
        {
          title: 'Send Message',
          description: 'Interact with the agent via message',
          endpoint: 'POST /v1/agent/interact',
          method: 'POST' as const,
          execute: () => cirisClient.agent.interact('Hello from API demo!', { channel_id: 'demo_channel' }),
          params: { message: 'Hello from API demo!', channel_id: 'demo_channel' }
        },
        {
          title: 'Get Conversation History',
          description: 'Retrieve recent conversation history',
          endpoint: 'GET /v1/agent/history',
          method: 'GET' as const,
          execute: () => cirisClient.agent.getHistory({ channel_id: 'demo_channel', limit: 5 })
        },
        {
          title: 'Get Active Channels',
          description: 'List all active communication channels',
          endpoint: 'GET /v1/agent/channels',
          method: 'GET' as const,
          execute: () => cirisClient.agent.getChannels()
        }
      ]
    },
    memory: {
      title: 'Memory Operations',
      demos: [
        {
          title: 'Create Memory Node',
          description: 'Store a new memory node in the graph',
          endpoint: 'POST /v1/memory/store',
          method: 'POST' as const,
          execute: () => cirisClient.memory.createNode({
            type: 'OBSERVATION',
            scope: 'LOCAL',
            attributes: {
              source: 'api_demo',
              content: 'Test memory from API demo',
              timestamp: new Date().toISOString()
            }
          }),
          params: {
            type: 'OBSERVATION',
            scope: 'LOCAL',
            attributes: { source: 'api_demo', content: 'Test memory' }
          }
        },
        {
          title: 'Query Memory',
          description: 'Search memory graph with filters',
          endpoint: 'POST /v1/memory/query',
          method: 'POST' as const,
          execute: () => cirisClient.memory.query('', { type: 'OBSERVATION', limit: 5 }),
          params: { query: '', type: 'OBSERVATION', limit: 5 }
        },
        {
          title: 'Search Memory',
          description: 'Full-text search across memories',
          endpoint: 'GET /v1/memory/search',
          method: 'GET' as const,
          execute: () => cirisClient.memory.search('test', { limit: 5 })
        },
        {
          title: 'Memory Statistics',
          description: 'Get memory graph statistics',
          endpoint: 'GET /v1/memory/stats',
          method: 'GET' as const,
          execute: () => cirisClient.memory.getStats()
        },
        {
          title: 'Memory Timeline',
          description: 'View memories in chronological order',
          endpoint: 'GET /v1/memory/timeline',
          method: 'GET' as const,
          execute: () => cirisClient.memory.getTimeline()
        },
        {
          title: 'Visualize Memory Graph',
          description: 'Generate interactive graph visualization of memories',
          endpoint: 'GET /v1/memory/visualize/graph',
          method: 'GET' as const,
          execute: () => cirisClient.memory.getVisualization({
            layout: 'timeline',
            hours: 24,
            limit: 30
          }),
          params: { layout: 'timeline', hours: 24, limit: 30 }
        }
      ]
    },
    system: {
      title: 'System Management',
      demos: [
        {
          title: 'System Health',
          description: 'Overall system health status',
          endpoint: 'GET /v1/system/health',
          method: 'GET' as const,
          execute: () => cirisClient.system.getHealth()
        },
        {
          title: 'Resource Usage',
          description: 'Current CPU, memory, and disk usage',
          endpoint: 'GET /v1/system/resources',
          method: 'GET' as const,
          execute: () => cirisClient.system.getResources()
        },
        {
          title: 'System Time',
          description: 'Get system time and timezone info',
          endpoint: 'GET /v1/system/time',
          method: 'GET' as const,
          execute: () => cirisClient.system.getTime()
        },
        {
          title: 'Service Status',
          description: 'Status of all CIRIS services',
          endpoint: 'GET /v1/system/services',
          method: 'GET' as const,
          execute: () => cirisClient.system.getServices()
        },
        {
          title: 'Processor States',
          description: 'Get all 6 cognitive processor states',
          endpoint: 'GET /v1/system/processors',
          method: 'GET' as const,
          execute: () => cirisClient.system.getProcessorStates()
        },
        {
          title: 'Runtime Status',
          description: 'Current runtime control status',
          endpoint: 'GET /v1/system/runtime/state',
          method: 'GET' as const,
          execute: () => cirisClient.system.getRuntimeStatus()
        },
        {
          title: 'Processing Queue',
          description: 'View processing queue status',
          endpoint: 'GET /v1/system/runtime/queue',
          method: 'GET' as const,
          execute: () => cirisClient.system.getProcessingQueueStatus()
        },
        {
          title: 'Service Health Details',
          description: 'Detailed health info for all services',
          endpoint: 'GET /v1/system/services/health',
          method: 'GET' as const,
          execute: () => cirisClient.system.getServiceHealthDetails()
        },
        {
          title: 'Adapter List',
          description: 'List all registered adapters',
          endpoint: 'GET /v1/system/adapters',
          method: 'GET' as const,
          execute: () => cirisClient.system.getAdapters()
        },
        {
          title: 'Register Adapter',
          description: 'Register a new adapter (e.g., Discord, CLI)',
          endpoint: 'POST /v1/system/adapters/{type}',
          method: 'POST' as const,
          execute: () => cirisClient.system.registerAdapter('cli', {
            enabled: true,
            priority: 2
          }),
          params: { adapter_type: 'cli', config: { enabled: true, priority: 2 } }
        },
        {
          title: 'Unregister Adapter',
          description: 'Unregister an adapter',
          endpoint: 'DELETE /v1/system/adapters/{id}',
          method: 'DELETE' as const,
          execute: () => cirisClient.system.unregisterAdapter('cli_adapter'),
          params: { adapter_id: 'cli_adapter' }
        },
        {
          title: 'Service Priorities',
          description: 'Update service provider priorities',
          endpoint: 'PUT /v1/system/services/{provider}/priority',
          method: 'PUT' as const,
          execute: () => cirisClient.system.updateServicePriority('memory_provider', {
            priority: 'HIGH',
            priority_group: 0
          }),
          params: { provider: 'memory_provider', priority: 'HIGH', priority_group: 0 }
        },
        {
          title: 'Circuit Breakers',
          description: 'Reset circuit breakers for services',
          endpoint: 'POST /v1/system/services/circuit-breakers/reset',
          method: 'POST' as const,
          execute: () => cirisClient.system.resetCircuitBreakers()
        },
        {
          title: 'Selection Logic',
          description: 'Explain service selection logic',
          endpoint: 'GET /v1/system/services/selection-logic',
          method: 'GET' as const,
          execute: () => cirisClient.system.getServiceSelectionExplanation()
        },
        {
          title: 'Single Step Debug',
          description: 'Execute single processing step for debugging',
          endpoint: 'POST /v1/system/runtime/single-step',
          method: 'POST' as const,
          execute: () => cirisClient.system.singleStepProcessor()
        },
        {
          title: 'Available Tools',
          description: 'Get list of all available tools from all tool providers',
          endpoint: 'GET /v1/system/tools',
          method: 'GET' as const,
          execute: async () => {
            const result = await cirisClient.system.getTools();
            console.log('Tools API response:', result);
            return result;
          }
        }
      ]
    },
    config: {
      title: 'Configuration',
      demos: [
        {
          title: 'Get All Config',
          description: 'Retrieve all configuration values',
          endpoint: 'GET /v1/config',
          method: 'GET' as const,
          execute: () => cirisClient.config.getConfig()
        },
        {
          title: 'Get Config Value',
          description: 'Get specific configuration value',
          endpoint: 'GET /v1/config/{key}',
          method: 'GET' as const,
          execute: () => cirisClient.config.get('agent_name')
        },
        {
          title: 'Set Config Value',
          description: 'Update configuration value',
          endpoint: 'PUT /v1/config/{key}',
          method: 'PUT' as const,
          execute: () => cirisClient.config.set('demo_key', 'demo_value', 'Demo config value'),
          params: { key: 'demo_key', value: 'demo_value', description: 'Demo config value' }
        }
      ]
    },
    telemetry: {
      title: 'Telemetry & Observability',
      demos: [
        {
          title: 'Telemetry Overview',
          description: 'System metrics summary',
          endpoint: 'GET /v1/telemetry/overview',
          method: 'GET' as const,
          execute: () => cirisClient.telemetry.getOverview()
        },
        {
          title: 'All Metrics',
          description: 'List all available metrics',
          endpoint: 'GET /v1/telemetry/metrics',
          method: 'GET' as const,
          execute: () => cirisClient.telemetry.getMetrics()
        },
        {
          title: 'System Logs',
          description: 'Recent system log entries',
          endpoint: 'GET /v1/telemetry/logs',
          method: 'GET' as const,
          execute: () => cirisClient.telemetry.getLogs({ page_size: 10 })
        },
        {
          title: 'Resource History',
          description: 'Historical resource usage data',
          endpoint: 'GET /v1/telemetry/resources/history',
          method: 'GET' as const,
          execute: () => cirisClient.telemetry.getResourceHistory({
            start_time: new Date(Date.now() - 3600000).toISOString(),
            end_time: new Date().toISOString()
          })
        },
        {
          title: 'Distributed Traces',
          description: 'Recent request traces',
          endpoint: 'GET /v1/telemetry/traces',
          method: 'GET' as const,
          execute: () => cirisClient.telemetry.getTraces({ page_size: 5 })
        }
      ]
    },
    audit: {
      title: 'Audit Trail',
      demos: [
        {
          title: 'Recent Audit Entries',
          description: 'List recent audit trail entries',
          endpoint: 'GET /v1/audit/entries',
          method: 'GET' as const,
          execute: () => cirisClient.audit.getEntries({ page_size: 10 })
        },
        {
          title: 'Search Audit Trail',
          description: 'Search audit entries by criteria',
          endpoint: 'POST /v1/audit/search',
          method: 'POST' as const,
          execute: () => cirisClient.audit.searchEntries({
            service: 'api',
            page_size: 5
          }),
          params: { service: 'api', page_size: 5 }
        }
      ]
    },
    wa: {
      title: 'Wise Authority',
      demos: [
        {
          title: 'WA Status',
          description: 'Wise Authority system status',
          endpoint: 'GET /v1/wa/status',
          method: 'GET' as const,
          execute: () => cirisClient.wiseAuthority.getStatus()
        },
        {
          title: 'WA Permissions',
          description: 'List granted permissions',
          endpoint: 'GET /v1/wa/permissions',
          method: 'GET' as const,
          execute: () => cirisClient.wiseAuthority.getPermissions()
        },
        {
          title: 'Pending Deferrals',
          description: 'List pending decision deferrals',
          endpoint: 'GET /v1/wa/deferrals',
          method: 'GET' as const,
          execute: () => cirisClient.wiseAuthority.getDeferrals()
        },
        {
          title: 'Request Guidance',
          description: 'Request guidance on a decision',
          endpoint: 'POST /v1/wa/guidance',
          method: 'POST' as const,
          execute: () => cirisClient.wiseAuthority.requestGuidance({
            topic: 'Demo guidance request from API explorer',
            context: { demo: true, timestamp: new Date().toISOString() },
            urgency: 'low'
          }),
          params: {
            topic: 'Demo guidance request',
            context: { demo: true },
            urgency: 'low'
          }
        }
      ]
    },
    auth: {
      title: 'Authentication',
      demos: [
        {
          title: 'Current User',
          description: 'Get current authenticated user',
          endpoint: 'GET /v1/auth/me',
          method: 'GET' as const,
          execute: () => cirisClient.auth.getMe()
        },
        {
          title: 'Refresh Token',
          description: 'Refresh authentication token',
          endpoint: 'POST /v1/auth/refresh',
          method: 'POST' as const,
          execute: () => cirisClient.auth.refresh()
        }
      ]
    },
    users: {
      title: 'User Management',
      demos: [
        {
          title: 'List Users',
          description: 'List all users with filtering',
          endpoint: 'GET /v1/users',
          method: 'GET' as const,
          execute: () => cirisClient.users.list({ page_size: 10 }),
          params: { page_size: 10 }
        },
        {
          title: 'Get User Details',
          description: 'Get detailed info about a user',
          endpoint: 'GET /v1/users/{userId}',
          method: 'GET' as const,
          execute: () => cirisClient.users.get('admin'),
          params: { userId: 'admin' }
        },
        {
          title: 'Create User',
          description: 'Create a new user account',
          endpoint: 'POST /v1/users',
          method: 'POST' as const,
          execute: () => cirisClient.users.create({
            username: 'demo_user',
            password: 'demo_password123',
            api_role: 'OBSERVER'
          }),
          params: {
            username: 'demo_user',
            password: 'demo_password123',
            api_role: 'OBSERVER'
          }
        },
        {
          title: 'Update User',
          description: 'Update user role or status',
          endpoint: 'PUT /v1/users/{userId}',
          method: 'PUT' as const,
          execute: () => cirisClient.users.update('demo_user', {
            api_role: 'ADMIN',
            is_active: true
          }),
          params: {
            userId: 'demo_user',
            api_role: 'ADMIN',
            is_active: true
          }
        },
        {
          title: 'Change Password',
          description: 'Change user password',
          endpoint: 'PUT /v1/users/{userId}/password',
          method: 'PUT' as const,
          execute: () => cirisClient.users.changePassword('admin', {
            current_password: 'current_password',
            new_password: 'new_password123'
          }),
          params: {
            userId: 'admin',
            current_password: 'current_password',
            new_password: 'new_password123'
          }
        },
        {
          title: 'List API Keys',
          description: 'List API keys for a user',
          endpoint: 'GET /v1/users/{userId}/api-keys',
          method: 'GET' as const,
          execute: () => cirisClient.users.listAPIKeys('admin'),
          params: { userId: 'admin' }
        },
        {
          title: 'Mint Wise Authority',
          description: 'Mint user as Wise Authority (requires ROOT)',
          endpoint: 'POST /v1/users/{userId}/mint-wa',
          method: 'POST' as const,
          execute: () => cirisClient.users.mintWiseAuthority('demo_user', {
            wa_role: 'AUTHORITY',
            signature: 'ed25519_signature_here'
          }),
          params: {
            userId: 'demo_user',
            wa_role: 'AUTHORITY',
            signature: 'ed25519_signature_here'
          }
        }
      ]
    },
    advanced: {
      title: 'Advanced Operations',
      demos: [
        {
          title: 'Emergency Shutdown',
          description: 'Initiate emergency shutdown with Ed25519 signature',
          endpoint: 'POST /emergency/shutdown',
          method: 'POST' as const,
          execute: () => fetch('/emergency/shutdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason: 'Emergency shutdown test',
              signature: 'ed25519_emergency_signature',
              public_key: 'ed25519_public_key'
            })
          }).then(r => r.json()),
          params: {
            reason: 'Emergency shutdown test',
            signature: 'ed25519_emergency_signature',
            public_key: 'ed25519_public_key'
          }
        },
        {
          title: 'Emergency Health Check',
          description: 'Check system health without authentication',
          endpoint: 'GET /emergency/health',
          method: 'GET' as const,
          execute: () => fetch('/emergency/health').then(r => r.json())
        },
        {
          title: 'WebSocket Connection',
          description: 'Real-time bidirectional communication',
          endpoint: 'WS /v1/ws',
          method: 'GET' as const,
          execute: () => Promise.resolve({
            message: 'WebSocket connections must be established using a WebSocket client',
            example: 'new WebSocket("ws://localhost:8080/v1/ws")',
            features: [
              'Real-time agent messages',
              'System events',
              'Telemetry updates',
              'Interactive chat'
            ]
          })
        },
        {
          title: 'OpenAPI Specification',
          description: 'Complete API documentation in OpenAPI format',
          endpoint: 'GET /openapi.json',
          method: 'GET' as const,
          execute: () => fetch('/openapi.json').then(r => r.json())
        }
      ]
    }
  };

  const executeDemo = async (demo: DemoSection) => {
    setLoading(true);
    setResult(null);
    setSelectedDemo(demo);

    try {
      const startTime = Date.now();
      const response = await demo.execute();
      const duration = Date.now() - startTime;

      setResult({
        success: true,
        data: response,
        duration,
        timestamp: new Date().toISOString()
      });

      toast.success(`${demo.title} completed in ${duration}ms`);
    } catch (error: any) {
      const errorResult = {
        success: false,
        error: error.message || 'Unknown error',
        details: error.response?.data || error,
        timestamp: new Date().toISOString()
      };
      setResult(errorResult);
      toast.error(`${demo.title} failed: ${errorResult.error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">CIRIS API Explorer</h1>
          <p className="mt-2 text-lg text-gray-600">
            Interactive demonstration of all 78+ API endpoints across 12 modules
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">API Categories</h3>
                <nav className="space-y-1">
                  {Object.entries(demoCategories).map(([key, category]) => (
                    <button
                      key={key}
                      onClick={() => setActiveCategory(key as keyof typeof demoCategories)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeCategory === key
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span>{category.title}</span>
                        <span className="text-xs text-gray-500">
                          {category.demos.length} endpoints
                        </span>
                      </div>
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          {/* Demo List */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {demoCategories[activeCategory].title} Endpoints
                </h3>
                <div className="space-y-3">
                  {demoCategories[activeCategory].demos.map((demo: DemoSection, index: number) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        selectedDemo === demo
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => executeDemo(demo)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900">
                            {demo.title}
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">
                            {demo.description}
                          </p>
                          <div className="mt-2 flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              demo.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                              demo.method === 'POST' ? 'bg-green-100 text-green-800' :
                              demo.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                              demo.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {demo.method}
                            </span>
                            <code className="text-xs text-gray-500 font-mono">
                              {demo.endpoint}
                            </code>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            executeDemo(demo);
                          }}
                          disabled={loading && selectedDemo === demo}
                          className="ml-4 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                          {loading && selectedDemo === demo ? (
                            <>
                              <SpinnerIcon className="mr-1" size="sm" />
                              Running...
                            </>
                          ) : (
                            'Execute'
                          )}
                        </button>
                      </div>
                      {demo.params && (
                        <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
                          <span className="font-medium text-gray-700">Parameters:</span>
                          <pre className="mt-1 text-gray-600 overflow-x-auto">
                            {JSON.stringify(demo.params, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Result Display */}
            {result && (
              <div className="mt-6 bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Response
                    </h3>
                    <div className="flex items-center space-x-4 text-sm">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${
                        result.success
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {result.success ? 'Success' : 'Error'}
                      </span>
                      {result.duration && (
                        <span className="text-gray-500">
                          {result.duration}ms
                        </span>
                      )}
                      <span className="text-gray-500">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  {/* Check if the result is SVG */}
                  {result.success && typeof result.data === 'string' && result.data.includes('<svg') ? (
                    <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
                      <div dangerouslySetInnerHTML={{ __html: result.data }} />
                    </div>
                  ) : (
                    <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
                      <pre className="text-sm text-gray-100 font-mono">
                        {JSON.stringify(result.success ? result.data : result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
