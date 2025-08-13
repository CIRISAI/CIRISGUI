// CIRIS TypeScript SDK - Main Client

import { Transport, TransportOptions } from './transport';
import { AuthResource } from './resources/auth';
import { AgentResource } from './resources/agent';
import { SystemResource } from './resources/system';
import { MemoryResource } from './resources/memory';
import { AuditResource } from './resources/audit';
import { ConfigResource } from './resources/config';
import { TelemetryResource } from './resources/telemetry';
import { WiseAuthorityResource } from './resources/wise-authority';
import { EmergencyResource } from './resources/emergency';
import { UsersResource } from './resources/users';
import { ManagerResource } from './resources/manager';
import { User } from './types';
import { SDK_VERSION } from './version';

export interface CIRISClientOptions {
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  enableRateLimiting?: boolean;
  onAuthError?: () => void;
}

export class CIRISClient {
  private transport: Transport;

  // Resource instances
  public readonly auth: AuthResource;
  public readonly agent: AgentResource;
  public readonly system: SystemResource;
  public readonly memory: MemoryResource;
  public readonly audit: AuditResource;
  public readonly config: ConfigResource;
  public readonly telemetry: TelemetryResource;
  public readonly wiseAuthority: WiseAuthorityResource;
  public readonly emergency: EmergencyResource;
  public readonly users: UsersResource;
  public readonly manager: ManagerResource;

  constructor(options: CIRISClientOptions = {}) {
    // Use environment variable if available, otherwise fall back to window location for browser
    const defaultBaseURL = typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : process.env.NEXT_PUBLIC_CIRIS_API_URL || 'http://localhost:8080';

    const transportOptions: TransportOptions = {
      baseURL: options.baseURL || defaultBaseURL,
      timeout: options.timeout,
      maxRetries: options.maxRetries,
      enableRateLimiting: options.enableRateLimiting !== false, // Default true
      onAuthError: options.onAuthError || (() => {
        // Default behavior: redirect to login
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      })
    };

    this.transport = new Transport(transportOptions);

    // Initialize resources
    this.auth = new AuthResource(this.transport);
    this.agent = new AgentResource(this.transport);
    this.system = new SystemResource(this.transport);
    this.memory = new MemoryResource(this.transport);
    this.audit = new AuditResource(this.transport);
    this.config = new ConfigResource(this.transport);
    this.telemetry = new TelemetryResource(this.transport);
    this.wiseAuthority = new WiseAuthorityResource(this.transport);
    this.emergency = new EmergencyResource(this.transport);
    this.users = new UsersResource(this.transport);
    this.manager = new ManagerResource(this.transport);
  }

  /**
   * Login convenience method
   */
  async login(username: string, password: string): Promise<User> {
    return this.auth.login(username, password);
  }

  /**
   * Logout convenience method
   */
  async logout(): Promise<void> {
    return this.auth.logout();
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.auth.getCurrentUser();
  }

  /**
   * Update client configuration (e.g., to switch agents)
   */
  setConfig(options: Partial<CIRISClientOptions> & { authToken?: string }): void {
    if (options.baseURL) {
      this.transport.setBaseURL(options.baseURL);
    }
    if (options.authToken !== undefined) {
      this.transport.setAuthToken(options.authToken);
    }
  }

  /**
   * Get SDK version information
   */
  getVersion() {
    return SDK_VERSION;
  }

  /**
   * Get SDK version string
   */
  getVersionString(): string {
    return SDK_VERSION.version;
  }

  /**
   * Update base URL (convenience method for static agent configuration)
   */
  setBaseURL(baseURL: string): void {
    this.transport.setBaseURL(baseURL);
  }

  /**
   * Get current base URL (for debugging)
   */
  getBaseURL(): string {
    return this.transport.getBaseURL();
  }

  /**
   * Create a new client instance with different configuration
   */
  withConfig(options: Partial<CIRISClientOptions> & { authToken?: string }): CIRISClient {
    const newOptions = {
      baseURL: options.baseURL || this.transport.getBaseURL(),
      timeout: options.timeout,
      maxRetries: options.maxRetries,
      enableRateLimiting: options.enableRateLimiting,
      onAuthError: options.onAuthError
    };

    const newClient = new CIRISClient(newOptions);
    if (options.authToken) {
      newClient.transport.setAuthToken(options.authToken);
    }

    return newClient;
  }

  /**
   * Send a message to the agent (convenience method)
   */
  async interact(message: string, options?: { channel_id?: string; context?: Record<string, any> }) {
    return this.agent.interact(message, options);
  }

  /**
   * Get agent status (convenience method)
   */
  async getStatus() {
    return this.agent.getStatus();
  }

  /**
   * Get system health (convenience method)
   */
  async getHealth() {
    return this.system.getHealth();
  }
}

// Export a singleton instance for easy use
export const cirisClient = new CIRISClient();

// Export everything for advanced usage
export * from './types';
export * from './exceptions';
export * from './auth-store';
export * from './rate-limiter';
export * from './transport';
