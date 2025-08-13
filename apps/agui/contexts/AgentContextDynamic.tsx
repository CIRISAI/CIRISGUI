'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { cirisClient } from '../lib/ciris-sdk';
import { AgentInfo } from '../lib/ciris-sdk/resources/manager';
import type { APIRole, WARole } from '../lib/ciris-sdk';

interface AgentRole {
  agentId: string;
  apiRole: APIRole;
  waRole?: WARole;
  isAuthority: boolean;
  lastChecked: Date;
}

interface AgentContextType {
  agents: AgentInfo[];
  currentAgent: AgentInfo | null;
  currentAgentRole: AgentRole | null;
  agentRoles: Map<string, AgentRole>;
  selectAgent: (agentId: string) => Promise<void>;
  refreshAgents: () => Promise<void>;
  refreshAgentRoles: () => Promise<void>;
  isLoadingAgents: boolean;
  isLoadingRoles: boolean;
  error: Error | null;
  mode: 'standalone' | 'managed';
  apiBase: string;
}

const AgentContext = createContext<AgentContextType | null>(null);

// Detect deployment mode based on URL path
function detectDeploymentMode(): { mode: 'standalone' | 'managed', agentId: string | null, apiBase: string } {
  if (typeof window === 'undefined') {
    // Server-side rendering, default to standalone
    return { mode: 'standalone', agentId: null, apiBase: '/v1' };
  }

  const path = window.location.pathname;
  const isManaged = path.startsWith('/agent/');

  if (isManaged) {
    // Managed mode: extract agent ID from /agent/{agent_id}
    const pathParts = path.split('/');
    const agentId = pathParts[2] || 'default';
    const apiBase = `/api/${agentId}/v1`;
    return { mode: 'managed', agentId, apiBase };
  } else {
    // Standalone mode: direct API access
    return { mode: 'standalone', agentId: 'default', apiBase: '/v1' };
  }
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [currentAgent, setCurrentAgent] = useState<AgentInfo | null>(null);
  const [agentRoles, setAgentRoles] = useState<Map<string, AgentRole>>(new Map());
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  // Detect mode and configure SDK
  const { mode, agentId: detectedAgentId, apiBase } = detectDeploymentMode();

  // Initialize based on mode
  useEffect(() => {
    if (mode === 'standalone') {
      // Configure SDK for standalone mode first
      cirisClient.setConfig({
        baseURL: window.location.origin
      });

      // In standalone mode, fetch the real agent identity
      const fetchAgentIdentity = async () => {
        setIsLoadingAgents(true);
        setError(null);

        try {
          // Fetch real identity from the API
          const identity = await cirisClient.agent.getIdentity();

          // Create agent info from real identity
          const realAgent: AgentInfo = {
            agent_id: identity.agent_id,
            agent_name: identity.name, // Real name from API!
            container_name: 'standalone',
            status: 'running',
            api_endpoint: `${window.location.origin}${apiBase}`,
            created_at: new Date().toISOString(),
            health: 'healthy',
            update_available: false
          };

          setAgents([realAgent]);
          setCurrentAgent(realAgent);
        } catch (err) {
          console.error('Failed to fetch agent identity:', err);
          setError(err instanceof Error ? err : new Error('Failed to fetch agent identity'));
          // Fail fast - don't create fake data
          setAgents([]);
          setCurrentAgent(null);
        } finally {
          setIsLoadingAgents(false);
        }
      };

      fetchAgentIdentity();
    } else {
      // In managed mode, discover agents from CIRISManager
      refreshAgents();
    }
  }, [mode]);

  // Discover agents from CIRISManager (managed mode only)
  const refreshAgents = async () => {
    if (mode === 'standalone') {
      // No need to discover in standalone mode
      return;
    }
    setIsLoadingAgents(true);
    setError(null);

    try {
      const discovered = await cirisClient.manager.listAgents();
      setAgents(discovered);

      // If we're in managed mode with a specific agent ID, select it
      if (detectedAgentId) {
        const targetAgent = discovered.find(a => a.agent_id === detectedAgentId);
        if (targetAgent) {
          setCurrentAgent(targetAgent);
          // Configure SDK for this specific agent
          cirisClient.setConfig({
            baseURL: `${window.location.origin}${apiBase}`
          });
        }
      } else if (!currentAgent && discovered.length > 0) {
        // Otherwise select first running agent
        const runningAgent = discovered.find(a => a.status === 'running');
        if (runningAgent) {
          await selectAgent(runningAgent.agent_id);
        }
      }
    } catch (err) {
      console.error('Failed to discover agents:', err);
      setError(err instanceof Error ? err : new Error('Failed to discover agents'));
    } finally {
      setIsLoadingAgents(false);
    }
  };

  // Load agent roles when user logs in
  const refreshAgentRoles = async () => {
    if (!user) return;

    setIsLoadingRoles(true);
    const newRoles = new Map<string, AgentRole>();

    for (const agent of agents) {
      if (agent.status === 'running') {
        try {
          // In standalone mode, use the configured base URL
          // In managed mode, create client for specific agent
          const agentClient = mode === 'standalone'
            ? cirisClient
            : cirisClient.withConfig({
                baseURL: `${window.location.origin}/api/${agent.agent_id}`
              });

          const currentUser = await agentClient.auth.getCurrentUser();

          if (currentUser) {
            newRoles.set(agent.agent_id, {
              agentId: agent.agent_id,
              apiRole: currentUser.api_role || currentUser.role,
              waRole: currentUser.wa_role,
              isAuthority: currentUser.wa_role === 'AUTHORITY',
              lastChecked: new Date()
            });
          }
        } catch (error) {
          console.error(`Failed to get role for agent ${agent.agent_id}:`, error);
        }
      }
    }

    setAgentRoles(newRoles);
    setIsLoadingRoles(false);
  };

  const selectAgent = async (agentId: string) => {
    const agent = agents.find(a => a.agent_id === agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    setCurrentAgent(agent);

    // Update SDK based on mode
    if (mode === 'standalone') {
      // In standalone mode, always use direct /v1 access
      cirisClient.setConfig({
        baseURL: window.location.origin
      });
    } else {
      // In managed mode, use multi-agent routing pattern
      const baseURL = `${window.location.origin}/api/${agentId}`;
      cirisClient.setConfig({ baseURL });
    }
  };

  // Refresh roles when agents change or user logs in
  useEffect(() => {
    if (user && agents.length > 0) {
      refreshAgentRoles();
    }
  }, [user, agents]);

  // Auto-refresh agents every 30 seconds (managed mode only)
  useEffect(() => {
    if (mode === 'managed') {
      const interval = setInterval(refreshAgents, 30000);
      return () => clearInterval(interval);
    }
  }, [mode]);

  const currentAgentRole = currentAgent
    ? agentRoles.get(currentAgent.agent_id) || null
    : null;

  const value: AgentContextType = {
    agents,
    currentAgent,
    currentAgentRole,
    agentRoles,
    selectAgent,
    refreshAgents,
    refreshAgentRoles,
    isLoadingAgents,
    isLoadingRoles,
    error,
    mode,
    apiBase
  };

  return (
    <AgentContext.Provider value={value}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error('useAgent must be used within AgentProvider');
  }
  return context;
}
