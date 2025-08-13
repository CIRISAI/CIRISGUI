'use client';

import { useState } from 'react';
import { ProtectedRoute } from '../../components/ProtectedRoute';

interface EndpointDoc {
  method: string;
  path: string;
  description: string;
  auth: string;
  params?: any;
  response?: any;
}

interface CategoryDoc {
  title: string;
  description: string;
  baseUrl: string;
  endpoints: EndpointDoc[];
}

export default function DocsPage() {
  const [activeCategory, setActiveCategory] = useState('overview');

  const documentation: Record<string, CategoryDoc> = {
    overview: {
      title: 'API Overview',
      description: 'CIRIS provides a comprehensive REST API with 78+ endpoints across 12 modules for agent interaction, system management, and observability.',
      baseUrl: 'http://localhost:8080',
      endpoints: [
        {
          method: 'INFO',
          path: '/v1/*',
          description: 'All API endpoints require authentication except /emergency/* endpoints',
          auth: 'Bearer token from /v1/auth/login',
          response: {
            authentication: 'JWT Bearer token',
            roles: ['OBSERVER', 'ADMIN', 'AUTHORITY', 'SYSTEM_ADMIN'],
            'rate-limiting': '100 requests per minute',
            versioning: 'v1 (stable)'
          }
        }
      ]
    },
    agent: {
      title: 'Agent Interaction',
      description: 'Core endpoints for interacting with the CIRIS agent',
      baseUrl: '/v1/agent',
      endpoints: [
        {
          method: 'POST',
          path: '/interact',
          description: 'Send a message to the agent and receive a response',
          auth: 'Required (OBSERVER+)',
          params: {
            message: 'string - The message to send',
            channel_id: 'string - Channel identifier (e.g., "api_user", "discord_123")',
            context: 'object - Optional additional context'
          },
          response: {
            message_id: 'string - Unique message identifier',
            state: 'string - Current cognitive state',
            timestamp: 'string - ISO timestamp'
          }
        },
        {
          method: 'GET',
          path: '/status',
          description: 'Get current agent status and cognitive state',
          auth: 'Required (OBSERVER+)',
          response: {
            state: 'WAKEUP | WORK | PLAY | SOLITUDE | DREAM | SHUTDOWN',
            health: 'healthy | degraded | unhealthy',
            uptime_seconds: 'number',
            active_tasks: 'number'
          }
        },
        {
          method: 'GET',
          path: '/identity',
          description: 'Get agent identity and capabilities',
          auth: 'Required (OBSERVER+)',
          response: {
            name: 'string',
            version: 'string',
            capabilities: ['array of capabilities'],
            personality_traits: 'object'
          }
        },
        {
          method: 'GET',
          path: '/history',
          description: 'Get conversation history',
          auth: 'Required (OBSERVER+)',
          params: {
            channel_id: 'string - Filter by channel',
            limit: 'number - Max results (default: 20)',
            offset: 'number - Pagination offset'
          }
        },
        {
          method: 'GET',
          path: '/channels',
          description: 'List all active communication channels',
          auth: 'Required (OBSERVER+)'
        }
      ]
    },
    system: {
      title: 'System Management',
      description: 'System control, health monitoring, and adapter management',
      baseUrl: '/v1/system',
      endpoints: [
        {
          method: 'GET',
          path: '/health',
          description: 'Overall system health status',
          auth: 'Optional (degraded info without auth)',
          response: {
            status: 'healthy | degraded | unhealthy',
            version: 'string',
            uptime: 'number',
            services: 'object - Service health summary'
          }
        },
        {
          method: 'GET',
          path: '/services',
          description: 'Status of all CIRIS services',
          auth: 'Required (OBSERVER+)',
          response: {
            services: [{
              name: 'string',
              type: 'graph | core | infrastructure | governance | special',
              healthy: 'boolean',
              available: 'boolean',
              uptime_seconds: 'number',
              metrics: 'object'
            }]
          }
        },
        {
          method: 'GET',
          path: '/adapters',
          description: 'List all registered adapters',
          auth: 'Required (ADMIN+)'
        },
        {
          method: 'POST',
          path: '/adapters/{type}',
          description: 'Register a new adapter (discord, cli, api)',
          auth: 'Required (ADMIN+)',
          params: {
            config: {
              enabled: 'boolean',
              priority: 'number',
              // Type-specific config
            }
          }
        },
        {
          method: 'DELETE',
          path: '/adapters/{id}',
          description: 'Unregister an adapter',
          auth: 'Required (ADMIN+)'
        },
        {
          method: 'POST',
          path: '/runtime/{action}',
          description: 'Runtime control (pause, resume, state)',
          auth: 'Required (ADMIN+)',
          params: {
            action: 'pause | resume | state',
            duration: 'number - For pause action (seconds)'
          }
        },
        {
          method: 'GET',
          path: '/runtime/queue',
          description: 'Get processing queue status',
          auth: 'Required (ADMIN+)'
        },
        {
          method: 'POST',
          path: '/runtime/single-step',
          description: 'Execute single processing step (debug)',
          auth: 'Required (ADMIN+)'
        },
        {
          method: 'GET',
          path: '/processors',
          description: 'Get info about 6 cognitive processor states',
          auth: 'Required (OBSERVER+)'
        }
      ]
    },
    memory: {
      title: 'Memory Operations',
      description: 'Graph-based memory storage and retrieval',
      baseUrl: '/v1/memory',
      endpoints: [
        {
          method: 'POST',
          path: '/store',
          description: 'Create a new memory node',
          auth: 'Required (OBSERVER+)',
          params: {
            type: 'OBSERVATION | CONCEPT | RELATIONSHIP | EMOTION | PLAN',
            scope: 'LOCAL | GLOBAL',
            attributes: 'object - Node-specific attributes'
          }
        },
        {
          method: 'POST',
          path: '/query',
          description: 'Query memory graph with filters',
          auth: 'Required (OBSERVER+)',
          params: {
            query: 'string - Search query',
            type: 'string - Filter by node type',
            scope: 'string - Filter by scope',
            limit: 'number'
          }
        },
        {
          method: 'GET',
          path: '/search',
          description: 'Full-text search across memories',
          auth: 'Required (OBSERVER+)',
          params: {
            q: 'string - Search query',
            limit: 'number'
          }
        },
        {
          method: 'GET',
          path: '/visualize/graph',
          description: 'Generate interactive graph visualization',
          auth: 'Required (OBSERVER+)',
          params: {
            layout: 'timeline | force | hierarchical',
            hours: 'number - Time window',
            limit: 'number - Max nodes'
          },
          response: 'SVG visualization'
        }
      ]
    },
    users: {
      title: 'User Management',
      description: 'User accounts, roles, and Wise Authority management',
      baseUrl: '/v1/users',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          description: 'List all users with filtering',
          auth: 'Required (ADMIN+)',
          params: {
            page: 'number',
            page_size: 'number',
            search: 'string',
            api_role: 'OBSERVER | ADMIN | AUTHORITY | SYSTEM_ADMIN',
            wa_role: 'ORACLE | STEWARD | HARBINGER | ROOT'
          }
        },
        {
          method: 'POST',
          path: '/',
          description: 'Create new user',
          auth: 'Required (SYSTEM_ADMIN)',
          params: {
            username: 'string',
            password: 'string',
            api_role: 'string'
          }
        },
        {
          method: 'GET',
          path: '/{userId}',
          description: 'Get user details',
          auth: 'Required (self or ADMIN+)'
        },
        {
          method: 'PUT',
          path: '/{userId}',
          description: 'Update user role/status',
          auth: 'Required (ADMIN+)',
          params: {
            api_role: 'string',
            is_active: 'boolean'
          }
        },
        {
          method: 'POST',
          path: '/{userId}/mint-wa',
          description: 'Mint user as Wise Authority',
          auth: 'Required (ROOT WA)',
          params: {
            wa_role: 'ORACLE | STEWARD | HARBINGER',
            signature: 'string - Ed25519 signature'
          }
        }
      ]
    },
    telemetry: {
      title: 'Telemetry & Observability',
      description: 'Metrics, logs, traces, and resource monitoring',
      baseUrl: '/v1/telemetry',
      endpoints: [
        {
          method: 'GET',
          path: '/overview',
          description: 'System metrics summary',
          auth: 'Required (OBSERVER+)'
        },
        {
          method: 'GET',
          path: '/metrics',
          description: 'All available metrics',
          auth: 'Required (OBSERVER+)'
        },
        {
          method: 'GET',
          path: '/logs',
          description: 'System log entries',
          auth: 'Required (ADMIN+)',
          params: {
            level: 'DEBUG | INFO | WARNING | ERROR',
            service: 'string - Filter by service',
            page_size: 'number'
          }
        },
        {
          method: 'GET',
          path: '/traces',
          description: 'Distributed request traces',
          auth: 'Required (ADMIN+)'
        },
        {
          method: 'GET',
          path: '/resources/history',
          description: 'Historical resource usage',
          auth: 'Required (OBSERVER+)',
          params: {
            start_time: 'ISO timestamp',
            end_time: 'ISO timestamp'
          }
        }
      ]
    },
    config: {
      title: 'Configuration Management',
      description: 'Dynamic configuration management',
      baseUrl: '/v1/config',
      endpoints: [
        {
          method: 'GET',
          path: '/',
          description: 'Get all configuration values',
          auth: 'Required (ADMIN+)'
        },
        {
          method: 'GET',
          path: '/{key}',
          description: 'Get specific config value',
          auth: 'Required (OBSERVER+)'
        },
        {
          method: 'PUT',
          path: '/{key}',
          description: 'Set configuration value',
          auth: 'Required (ADMIN+)',
          params: {
            value: 'any',
            description: 'string'
          }
        }
      ]
    },
    audit: {
      title: 'Audit Trail',
      description: 'Comprehensive audit logging for compliance',
      baseUrl: '/v1/audit',
      endpoints: [
        {
          method: 'GET',
          path: '/entries',
          description: 'List audit entries',
          auth: 'Required (ADMIN+)',
          params: {
            page: 'number',
            page_size: 'number',
            service: 'string',
            action: 'string'
          }
        },
        {
          method: 'POST',
          path: '/search',
          description: 'Search audit entries',
          auth: 'Required (ADMIN+)',
          params: {
            service: 'string',
            action: 'string',
            date_from: 'ISO timestamp',
            date_to: 'ISO timestamp'
          }
        }
      ]
    },
    wa: {
      title: 'Wise Authority',
      description: 'Moral guidance and decision deferral system',
      baseUrl: '/v1/wa',
      endpoints: [
        {
          method: 'GET',
          path: '/status',
          description: 'Wise Authority system status',
          auth: 'Required (OBSERVER+)'
        },
        {
          method: 'GET',
          path: '/permissions',
          description: 'List granted permissions',
          auth: 'Required (AUTHORITY+)'
        },
        {
          method: 'GET',
          path: '/deferrals',
          description: 'List pending deferrals',
          auth: 'Required (AUTHORITY+)'
        },
        {
          method: 'POST',
          path: '/guidance',
          description: 'Request moral guidance',
          auth: 'Required (OBSERVER+)',
          params: {
            topic: 'string',
            context: 'object',
            urgency: 'low | medium | high | critical'
          }
        }
      ]
    },
    auth: {
      title: 'Authentication',
      description: 'Authentication and authorization',
      baseUrl: '/v1/auth',
      endpoints: [
        {
          method: 'POST',
          path: '/login',
          description: 'Login with username/password',
          auth: 'None',
          params: {
            username: 'string',
            password: 'string'
          },
          response: {
            access_token: 'string - JWT token',
            token_type: 'bearer',
            user: 'object - User info'
          }
        },
        {
          method: 'GET',
          path: '/me',
          description: 'Get current user info',
          auth: 'Required'
        },
        {
          method: 'POST',
          path: '/refresh',
          description: 'Refresh authentication token',
          auth: 'Required'
        },
        {
          method: 'POST',
          path: '/logout',
          description: 'Logout and invalidate token',
          auth: 'Required'
        }
      ]
    },
    emergency: {
      title: 'Emergency Operations',
      description: 'Emergency endpoints that bypass normal authentication',
      baseUrl: '/emergency',
      endpoints: [
        {
          method: 'GET',
          path: '/health',
          description: 'Basic health check without auth',
          auth: 'None',
          response: {
            status: 'ok | error',
            timestamp: 'ISO timestamp'
          }
        },
        {
          method: 'POST',
          path: '/shutdown',
          description: 'Emergency shutdown with Ed25519 signature',
          auth: 'Ed25519 signature required',
          params: {
            reason: 'string',
            signature: 'string - Ed25519 signature',
            public_key: 'string - Ed25519 public key'
          }
        }
      ]
    },
    websocket: {
      title: 'WebSocket',
      description: 'Real-time bidirectional communication',
      baseUrl: '/v1/ws',
      endpoints: [
        {
          method: 'WS',
          path: '/',
          description: 'WebSocket connection for real-time updates',
          auth: 'Token in query param or first message',
          params: {
            token: 'string - Auth token (query param)',
            subscribe: 'array - Event types to subscribe'
          },
          response: {
            events: [
              'agent.message - Agent responses',
              'system.status - System status changes',
              'telemetry.metrics - Real-time metrics',
              'memory.update - Memory graph updates'
            ]
          }
        }
      ]
    }
  };

  const categoryKeys = Object.keys(documentation);
  const activeDoc = documentation[activeCategory] || documentation.overview;

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">CIRIS API Documentation</h1>
          <p className="mt-2 text-lg text-gray-600">
            Complete reference for all 78+ endpoints across 12 API modules
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white shadow rounded-lg sticky top-4">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">API Modules</h3>
                <nav className="space-y-1">
                  {categoryKeys.map((key) => (
                    <button
                      key={key}
                      onClick={() => setActiveCategory(key)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeCategory === key
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {documentation[key].title}
                    </button>
                  ))}
                </nav>
              </div>
            </div>
          </div>

          {/* Documentation Content */}
          <div className="lg:col-span-3">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{activeDoc.title}</h2>
                <p className="text-gray-600 mb-6">{activeDoc.description}</p>

                {activeDoc.baseUrl !== 'http://localhost:8080' && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Base URL: </span>
                    <code className="text-sm font-mono text-gray-900">{activeDoc.baseUrl}</code>
                  </div>
                )}

                <div className="space-y-6">
                  {activeDoc.endpoints.map((endpoint, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
                            endpoint.method === 'GET' ? 'bg-blue-100 text-blue-800' :
                            endpoint.method === 'POST' ? 'bg-green-100 text-green-800' :
                            endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                            endpoint.method === 'DELETE' ? 'bg-red-100 text-red-800' :
                            endpoint.method === 'WS' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {endpoint.method}
                          </span>
                          <code className="text-sm font-mono text-gray-900">{endpoint.path}</code>
                        </div>
                        <span className="text-xs text-gray-500">{endpoint.auth}</span>
                      </div>

                      <p className="text-sm text-gray-600 mb-3">{endpoint.description}</p>

                      {endpoint.params && (
                        <div className="mb-3">
                          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Parameters</h4>
                          <div className="bg-gray-50 rounded p-3">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                              {typeof endpoint.params === 'object'
                                ? JSON.stringify(endpoint.params, null, 2)
                                : endpoint.params}
                            </pre>
                          </div>
                        </div>
                      )}

                      {endpoint.response && (
                        <div>
                          <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Response</h4>
                          <div className="bg-gray-50 rounded p-3">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                              {typeof endpoint.response === 'object'
                                ? JSON.stringify(endpoint.response, null, 2)
                                : endpoint.response}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
