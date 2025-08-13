import { useState, useEffect, useCallback } from 'react';
import { useSDK } from './useSDK';
import { AgentInfo } from '@/lib/ciris-sdk/resources/manager';

export interface UseAgentDiscoveryOptions {
  refreshInterval?: number; // Auto-refresh interval in milliseconds
  onError?: (error: Error) => void;
}

export function useAgentDiscovery(options: UseAgentDiscoveryOptions = {}) {
  const sdk = useSDK();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);

  const { refreshInterval = 30000, onError } = options; // Default 30s refresh

  const fetchAgents = useCallback(async () => {
    if (!sdk) return;

    setLoading(true);
    setError(null);

    try {
      const agentList = await sdk.manager.listAgents();
      setAgents(agentList);

      // If we have a selected agent, update its info
      if (selectedAgent) {
        const updated = agentList.find(a => a.agent_id === selectedAgent.agent_id);
        if (updated) {
          setSelectedAgent(updated);
        }
      }
    } catch (err) {
      // If manager is not available, use default local agent
      if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('Failed to fetch'))) {
        console.log('CIRIS Manager not available, using local dev agent');
        const defaultAgent: AgentInfo = {
          agent_id: 'datum',
          agent_name: 'Datum (Local Dev)',
          status: 'running',
          health: 'healthy',
          api_url: process.env.NEXT_PUBLIC_CIRIS_API_URL || 'http://localhost',
          api_port: 8080,
          api_endpoint: process.env.NEXT_PUBLIC_CIRIS_API_URL || 'http://localhost:8080',
          container_name: 'ciris-agent-datum',
          created_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          update_available: false,
        };
        setAgents([defaultAgent]);
        if (!selectedAgent) {
          setSelectedAgent(defaultAgent);
        }
        // Don't set error for expected connection failures
        return;
      }

      const error = err instanceof Error ? err : new Error('Failed to fetch agents');
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [sdk, selectedAgent, onError]);

  const selectAgent = useCallback((agentId: string) => {
    const agent = agents.find(a => a.agent_id === agentId);
    if (agent) {
      setSelectedAgent(agent);
    }
  }, [agents]);

  const refreshAgent = useCallback(async (agentId: string) => {
    if (!sdk) return;

    try {
      const agent = await sdk.manager.getAgent(agentId);

      // Update in the list
      setAgents(prev => prev.map(a =>
        a.agent_id === agentId ? agent : a
      ));

      // Update selected if it's the same
      if (selectedAgent?.agent_id === agentId) {
        setSelectedAgent(agent);
      }

      return agent;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to refresh agent');
      onError?.(error);
      throw error;
    }
  }, [sdk, selectedAgent, onError]);

  const getDeploymentStatus = useCallback(async (agentId: string) => {
    if (!sdk) return null;

    try {
      return await sdk.manager.getDeploymentStatus(agentId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get deployment status');
      onError?.(error);
      return null;
    }
  }, [sdk, onError]);

  const notifyUpdate = useCallback(async (
    agentId: string,
    version: string,
    changelog?: string,
    urgency?: 'low' | 'normal' | 'high' | 'critical'
  ) => {
    if (!sdk) return;

    try {
      const result = await sdk.manager.notifyUpdate(agentId, {
        agent_id: agentId,
        new_version: version,
        changelog,
        urgency
      });

      // Refresh the agent to get updated status
      await refreshAgent(agentId);

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to notify update');
      onError?.(error);
      throw error;
    }
  }, [sdk, refreshAgent, onError]);

  // Initial fetch
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Auto-refresh
  useEffect(() => {
    if (!refreshInterval || refreshInterval <= 0) return;

    const interval = setInterval(fetchAgents, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchAgents, refreshInterval]);

  return {
    // State
    agents,
    loading,
    error,
    selectedAgent,

    // Actions
    fetchAgents,
    selectAgent,
    refreshAgent,
    getDeploymentStatus,
    notifyUpdate,

    // Computed
    runningAgents: agents.filter(a => a.status === 'running'),
    stoppedAgents: agents.filter(a => a.status !== 'running'),
    agentsWithUpdates: agents.filter(a => a.update_available),
  };
}
