'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { cirisClient } from '../../lib/ciris-sdk';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { InfoIcon, StatusDot, SpinnerIcon, CubeIcon } from '../../components/Icons';
import { ProtectedRoute } from '../../components/ProtectedRoute';

interface Tool {
  name: string;
  description: string;
  adapter: string;
  handler?: string;
  schema?: any;
}

interface ToolsByAdapter {
  [adapter: string]: Tool[];
}

function ToolsPageContent() {
  // Fetch tools from the system tools endpoint
  const { data: toolsResponse, isLoading: loadingTools, refetch: refetchTools, error: toolsError } = useQuery({
    queryKey: ['system-tools'],
    queryFn: () => cirisClient.system.getTools(),
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Also fetch adapters for additional info
  const { data: adapterResponse, isLoading: loadingAdapters } = useQuery({
    queryKey: ['adapter-tools'],
    queryFn: async () => {
      const response = await cirisClient.system.getAdapters();
      return response;
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Group tools by provider
  const toolsByProvider: ToolsByAdapter = {};
  let totalTools = 0;

  if (toolsResponse && Array.isArray(toolsResponse)) {
    toolsResponse.forEach((tool: any) => {
      const provider = tool.provider || 'unknown';
      if (!toolsByProvider[provider]) {
        toolsByProvider[provider] = [];
      }
      toolsByProvider[provider].push({
        name: tool.name,
        description: tool.description,
        adapter: provider,
        schema: tool.schema
      });
      totalTools++;
    });
  }

  const activeProviderCount = Object.keys(toolsByProvider).length;
  const isLoading = loadingTools || loadingAdapters;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white shadow">
        <div className="px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Available Tools</h2>
              <p className="mt-1 text-sm text-gray-500">
                Tools provided by active adapters for use by the agent
              </p>
            </div>
            <button
              onClick={() => refetchTools()}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Tool Providers
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {activeProviderCount}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Total Available Tools
            </dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {totalTools}
            </dd>
          </div>
        </div>
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">
              Tool Bus Status
            </dt>
            <dd className="mt-1 text-xl font-semibold text-green-600 flex items-center">
              <StatusDot status="green" className="mr-2" />
              Operational
            </dd>
          </div>
        </div>
      </div>

      {/* Tools by Provider */}
      {isLoading ? (
        <div className="bg-white shadow rounded-lg p-8">
          <div className="text-center">
            <SpinnerIcon size="lg" className="mx-auto text-gray-500" />
            <p className="mt-4 text-gray-500">Loading available tools...</p>
          </div>
        </div>
      ) : totalTools === 0 ? (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="text-center">
              <CubeIcon size="lg" className="mx-auto text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No tools available</h3>
              <p className="mt-1 text-sm text-gray-500">
                Tools become available when adapters and tool services are loaded.
              </p>
            </div>
          </div>
        </div>
      ) : (
        Object.entries(toolsByProvider).map(([providerName, tools]) => (
          <div key={providerName} className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {providerName}
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
                </span>
              </div>

              <div className="space-y-3">
                {tools.map((tool, index) => (
                  <div
                    key={`${providerName}-${tool.name}-${index}`}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-gray-900">
                          {tool.name}
                        </h4>
                        {tool.description && (
                          <p className="mt-1 text-sm text-gray-600">
                            {tool.description}
                          </p>
                        )}
                        {tool.handler && (
                          <p className="mt-2 text-xs text-gray-500">
                            Handler: <code className="bg-gray-100 px-1 py-0.5 rounded">{tool.handler}</code>
                          </p>
                        )}
                      </div>
                      {tool.schema && (
                        <details className="ml-4 text-xs">
                          <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                            Schema
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto max-w-xs">
{JSON.stringify(tool.schema, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <InfoIcon className="text-blue-400" size="md" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              These tools are available for the agent to use when processing requests. The agent automatically
              selects appropriate tools based on the task and context. Tools are provided by adapters and
              become available when adapters are loaded on the System page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const ToolsPage = () => {
  return (
    <ProtectedRoute>
      <ToolsPageContent />
    </ProtectedRoute>
  );
};

export default ToolsPage;
