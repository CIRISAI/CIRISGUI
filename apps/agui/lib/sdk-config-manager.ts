/**
 * SDK Configuration Manager - Centralized management of CIRIS SDK configuration
 *
 * This manager ensures that the SDK is always properly configured based on:
 * 1. Deployment mode (standalone vs managed)
 * 2. Selected agent
 * 3. Authentication state
 *
 * It provides a single source of truth for SDK configuration and handles
 * all the complexity of multi-agent OAuth authentication.
 */

import { cirisClient } from './ciris-sdk';
import { detectDeploymentMode } from './api-utils';
import { AuthStore } from './ciris-sdk/auth-store';

export interface SDKConfig {
  baseURL: string;
  authToken?: string;
  agentId: string;
  mode: 'standalone' | 'managed';
}

class SDKConfigManager {
  private currentConfig: SDKConfig | null = null;
  private debugMode = process.env.NODE_ENV === 'development';

  /**
   * Initialize or update SDK configuration based on current context
   */
  configure(agentId: string, authToken?: string): SDKConfig {
    const { mode } = detectDeploymentMode();

    // Determine the correct base URL
    let baseURL: string;
    if (mode === 'managed') {
      // In managed mode, use /api/{agent_id} path (nginx adds /v1)
      baseURL = `${window.location.origin}/api/${agentId}`;
    } else {
      // In standalone mode, check if we have a stored API URL
      const storedApiUrl = localStorage.getItem(`agent_${agentId}_api_url`);
      if (storedApiUrl) {
        baseURL = storedApiUrl;
      } else {
        // Default to current origin
        baseURL = window.location.origin;
      }
    }

    // If auth token not provided, try to get from AuthStore
    if (!authToken) {
      authToken = AuthStore.getAccessToken() || undefined;
    }

    const config: SDKConfig = {
      baseURL,
      authToken,
      agentId,
      mode
    };

    // Only update if configuration actually changed
    if (this.hasConfigChanged(config)) {
      this.applyConfiguration(config);
    }

    return config;
  }

  /**
   * Configure SDK for OAuth callback - special handling for auth flow
   */
  configureForOAuthCallback(agentId: string, authToken: string): SDKConfig {
    const { mode } = detectDeploymentMode();

    // During OAuth callback, we need to be extra careful about the base URL
    let baseURL: string;
    if (mode === 'managed') {
      // Always use the proxied path in managed mode (nginx adds /v1)
      baseURL = `${window.location.origin}/api/${agentId}`;
    } else {
      // In standalone, use the origin
      baseURL = window.location.origin;
    }

    const config: SDKConfig = {
      baseURL,
      authToken,
      agentId,
      mode
    };

    // Always apply during OAuth callback
    this.applyConfiguration(config);

    // Store the configuration for future use
    this.storeConfiguration(config);

    return config;
  }

  /**
   * Get current SDK configuration
   */
  getCurrentConfig(): SDKConfig | null {
    return this.currentConfig;
  }

  /**
   * Check if SDK is properly configured for the given agent
   */
  isConfiguredFor(agentId: string): boolean {
    if (!this.currentConfig) return false;
    return this.currentConfig.agentId === agentId && !!this.currentConfig.authToken;
  }

  /**
   * Clear SDK configuration (for logout)
   */
  clear(): void {
    this.currentConfig = null;
    // Clear stored configurations
    localStorage.removeItem('sdk_config');
    this.log('SDK configuration cleared');
  }

  /**
   * Apply configuration to the SDK
   */
  private applyConfiguration(config: SDKConfig): void {
    this.log('Applying SDK configuration:', config);

    // Update the SDK
    cirisClient.setConfig({
      baseURL: config.baseURL,
      authToken: config.authToken
    });

    // Update current config
    this.currentConfig = config;

    this.log('SDK configured successfully');
  }

  /**
   * Check if configuration has changed
   */
  private hasConfigChanged(newConfig: SDKConfig): boolean {
    if (!this.currentConfig) return true;

    return (
      this.currentConfig.baseURL !== newConfig.baseURL ||
      this.currentConfig.authToken !== newConfig.authToken ||
      this.currentConfig.agentId !== newConfig.agentId ||
      this.currentConfig.mode !== newConfig.mode
    );
  }

  /**
   * Store configuration for persistence
   */
  private storeConfiguration(config: SDKConfig): void {
    // Don't store auth token in localStorage for security
    const configToStore = {
      baseURL: config.baseURL,
      agentId: config.agentId,
      mode: config.mode
    };

    localStorage.setItem('sdk_config', JSON.stringify(configToStore));

    // Store agent-specific API URL if available
    if (config.mode === 'standalone' && config.baseURL !== window.location.origin) {
      localStorage.setItem(`agent_${config.agentId}_api_url`, config.baseURL);
    }
  }

  /**
   * Restore configuration from storage
   */
  restoreConfiguration(): SDKConfig | null {
    const stored = localStorage.getItem('sdk_config');
    if (!stored) return null;

    try {
      const config = JSON.parse(stored);
      const authToken = AuthStore.getAccessToken() || undefined;

      return {
        ...config,
        authToken
      };
    } catch {
      return null;
    }
  }

  /**
   * Debug logging
   */
  private log(...args: any[]): void {
    if (this.debugMode) {
      console.log('[SDKConfigManager]', ...args);
    }
  }
}

// Export singleton instance
export const sdkConfigManager = new SDKConfigManager();
