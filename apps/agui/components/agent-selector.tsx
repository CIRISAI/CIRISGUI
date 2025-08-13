'use client';

import { useAgentDiscovery } from '@/hooks/useAgentDiscovery';
import { AlertCircle, CheckCircle, Clock, RefreshCw, Server } from 'lucide-react';
import { useState } from 'react';

interface AgentSelectorProps {
  onAgentSelect?: (agentId: string, apiEndpoint?: string) => void;
  className?: string;
}

export function AgentSelector({ onAgentSelect, className = '' }: AgentSelectorProps) {
  const {
    agents,
    loading,
    error,
    selectedAgent,
    selectAgent,
    fetchAgents,
    runningAgents,
    agentsWithUpdates,
  } = useAgentDiscovery({ refreshInterval: 30000 });

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAgents();
    setRefreshing(false);
  };

  const handleSelectAgent = (agentId: string) => {
    selectAgent(agentId);
    const agent = agents.find(a => a.agent_id === agentId);
    if (agent && onAgentSelect) {
      onAgentSelect(agentId, agent.api_endpoint);
    }
  };

  const getStatusIcon = (status: string, health?: string) => {
    if (status === 'running') {
      if (health === 'healthy') {
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      } else if (health === 'unhealthy') {
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      }
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (status === 'exited') {
      return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  const getStatusText = (status: string, exitCode?: number) => {
    if (status === 'running') return 'Running';
    if (status === 'exited') {
      return exitCode === 0 ? 'Stopped' : `Exited (${exitCode})`;
    }
    return status;
  };

  if (error && agents.length === 0) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
          <span className="text-red-700">Failed to load agent configuration</span>
        </div>
        <button
          onClick={handleRefresh}
          className="mt-2 text-red-600 hover:text-red-700 text-sm"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium flex items-center">
            <Server className="w-5 h-5 mr-2" />
            CIRIS Agents
          </h3>
          <button
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh agents"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-4">
        {loading && agents.length === 0 ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">Discovering agents...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-8">
            <Server className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">No agents found</p>
            <p className="text-sm text-gray-400 mt-1">Check agent configuration</p>
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent) => (
              <div
                key={agent.agent_id}
                onClick={() => handleSelectAgent(agent.agent_id)}
                className={`
                  p-3 rounded-lg border cursor-pointer transition-all
                  ${selectedAgent?.agent_id === agent.agent_id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      {getStatusIcon(agent.status, agent.health)}
                      <h4 className="ml-2 font-medium">{agent.agent_name}</h4>
                      {agent.update_available && (
                        <span className="ml-2 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded">
                          Update available
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-600">
                      <span className="inline-block mr-3">
                        Status: {getStatusText(agent.status, agent.exit_code)}
                      </span>
                      {agent.api_endpoint && (
                        <span className="inline-block">
                          API: {agent.api_endpoint}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Container: {agent.container_name}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {runningAgents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <span className="font-medium">{runningAgents.length}</span> running
              {agentsWithUpdates.length > 0 && (
                <span className="ml-2">
                  • <span className="font-medium">{agentsWithUpdates.length}</span> updates available
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
