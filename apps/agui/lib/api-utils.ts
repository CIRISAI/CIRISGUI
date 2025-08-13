/**
 * Utility functions for handling dual-mode API paths
 * Supports both standalone and managed deployment modes
 */

export interface DeploymentMode {
  mode: 'standalone' | 'managed';
  agentId: string | null;
  apiBase: string;
}

/**
 * Detect deployment mode based on URL path and domain
 */
export function detectDeploymentMode(): DeploymentMode {
  if (typeof window === 'undefined') {
    // Server-side rendering, default to standalone
    return { mode: 'standalone', agentId: null, apiBase: '/v1' };
  }

  const hostname = window.location.hostname;
  const path = window.location.pathname;

  // Check if we're on the production multi-agent domain
  const isProductionMultiAgent = hostname === 'agents.ciris.ai';

  // Check if path indicates managed mode
  const isManagedPath = path.startsWith('/agent/');

  if (isProductionMultiAgent || isManagedPath) {
    // In production or with /agent/ path, we're in managed mode
    let agentId = 'default';

    if (isManagedPath) {
      // Extract from path: /agent/{agent_id}
      const pathParts = path.split('/');
      agentId = pathParts[2] || 'default';
    } else {
      // In production without /agent/ path, check localStorage for selected agent
      const savedAgentId = typeof window !== 'undefined' ?
        localStorage.getItem('selectedAgentId') : null;
      agentId = savedAgentId || 'default';
    }

    const apiBase = `/api/${agentId}/v1`;
    return { mode: 'managed', agentId, apiBase };
  } else {
    // Standalone mode: direct API access
    return { mode: 'standalone', agentId: 'default', apiBase: '/v1' };
  }
}

/**
 * Get the API base URL for the current deployment mode
 */
export function getApiBaseUrl(agentId?: string): string {
  const { mode, agentId: detectedAgentId, apiBase } = detectDeploymentMode();

  if (mode === 'standalone') {
    return window.location.origin;
  } else {
    // In managed mode, use the provided agent ID or the detected one
    const targetAgentId = agentId || detectedAgentId || 'default';
    return `${window.location.origin}/api/${targetAgentId}`;
  }
}

/**
 * Get the full API URL for a specific endpoint
 */
export function getApiUrl(endpoint: string, agentId?: string): string {
  const { mode, agentId: detectedAgentId } = detectDeploymentMode();

  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

  if (mode === 'standalone') {
    return `${window.location.origin}/${cleanEndpoint}`;
  } else {
    // In managed mode, use the provided agent ID or the detected one
    const targetAgentId = agentId || detectedAgentId || 'default';
    return `${window.location.origin}/api/${targetAgentId}/${cleanEndpoint}`;
  }
}

/**
 * Check if the GUI is running in managed mode
 */
export function isManagedMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.location.pathname.startsWith('/agent/');
}

/**
 * Get the current agent ID in managed mode
 */
export function getCurrentAgentId(): string | null {
  const { mode, agentId } = detectDeploymentMode();
  return mode === 'managed' ? agentId : null;
}
