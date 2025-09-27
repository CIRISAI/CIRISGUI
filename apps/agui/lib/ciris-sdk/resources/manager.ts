import { BaseResource } from './base';

// Response interfaces
export interface AgentInfo {
  agent_id: string;
  agent_name: string;
  container_name: string;
  status: string;
  health?: string;
  api_url?: string;
  api_port?: number;
  api_endpoint?: string;
  created_at: string;
  started_at?: string;
  exit_code?: number;
  update_available: boolean;
}


export interface ManagerHealth {
  status: 'healthy' | 'unhealthy';
  service: string;
  docker?: {
    connected: boolean;
    version: string;
    containers: number;
    running: number;
  };
  error?: string;
}

export class ManagerResource extends BaseResource {
  /**
   * List all CIRIS agents managed by CIRISManager
   */
  async listAgents(): Promise<AgentInfo[]> {
    // Manager API always goes through the nginx proxy, not the agent endpoint
    // We need to use the origin URL to ensure it goes through the right path
    const managerUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/manager/v1/agents`
      : '/manager/v1/agents';

    const response = await this.transport.request<{ agents: AgentInfo[] }>('GET', managerUrl, { skipAuth: true });
    // Extract agents array from response
    return response.agents || [];
  }

  /**
   * Get detailed information about a specific agent
   */
  async getAgent(agentId: string): Promise<AgentInfo> {
    const managerUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/manager/v1/agents/${agentId}`
      : `/manager/v1/agents/${agentId}`;
    return this.transport.request<AgentInfo>('GET', managerUrl, { skipAuth: true });
  }


  /**
   * Health check endpoint for CIRISManager
   */
  async health(): Promise<ManagerHealth> {
    const managerUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/manager/v1/health`
      : '/manager/v1/health';
    return this.transport.request<ManagerHealth>('GET', managerUrl, { skipAuth: true });
  }
}
