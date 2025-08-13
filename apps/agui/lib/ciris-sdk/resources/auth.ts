// CIRIS TypeScript SDK - Auth Resource

import { BaseResource } from './base';
import { User, LoginResponse } from '../types';
import { AuthStore, AuthToken } from '../auth-store';
import { CIRISAuthError } from '../exceptions';

export class AuthResource extends BaseResource {
  /**
   * Login with username and password
   */
  async login(username: string, password: string): Promise<User> {
    try {
      // Call login endpoint
      const response = await this.transport.post<LoginResponse>(
        '/v1/auth/login',
        { username, password },
        { skipAuth: true }
      );

      // Save token
      const token: AuthToken = {
        access_token: response.access_token,
        token_type: response.token_type,
        expires_in: response.expires_in,
        user_id: response.user_id,
        role: response.role,
        created_at: Date.now()
      };
      AuthStore.saveToken(token);

      // Get user info
      const user = await this.getMe();
      AuthStore.saveUser(user);

      return user;
    } catch (error) {
      throw new CIRISAuthError(this.buildErrorMessage('login', (error as Error).message));
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      await this.transport.post('/v1/auth/logout');
    } catch {
      // Ignore logout errors
    } finally {
      AuthStore.clearToken();
    }
  }

  /**
   * Get current user info
   */
  async getMe(): Promise<User> {
    return this.transport.get<User>('/v1/auth/me');
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return AuthStore.isAuthenticated();
  }

  /**
   * Get current user from store
   */
  getCurrentUser(): User | null {
    return AuthStore.getUser();
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return AuthStore.getAccessToken();
  }

  /**
   * Refresh authentication token
   */
  async refresh(): Promise<LoginResponse> {
    try {
      const response = await this.transport.post<LoginResponse>('/v1/auth/refresh');

      // Update stored token
      const token: AuthToken = {
        access_token: response.access_token,
        token_type: response.token_type,
        expires_in: response.expires_in,
        user_id: response.user_id,
        role: response.role,
        created_at: Date.now()
      };
      AuthStore.saveToken(token);

      return response;
    } catch (error) {
      throw new CIRISAuthError(this.buildErrorMessage('refresh', (error as Error).message));
    }
  }

  // OAuth Provider Management

  /**
   * List configured OAuth providers
   * Requires: users.write permission (SYSTEM_ADMIN only)
   */
  async listOAuthProviders(): Promise<OAuthProviderList> {
    return this.transport.get<OAuthProviderList>('/v1/auth/oauth/providers');
  }

  /**
   * Configure an OAuth provider
   * Requires: users.write permission (SYSTEM_ADMIN only)
   */
  async configureOAuthProvider(
    provider: string,
    clientId: string,
    clientSecret: string,
    metadata?: Record<string, string>
  ): Promise<OAuthProviderConfig> {
    const body = {
      provider,
      client_id: clientId,
      client_secret: clientSecret,
      metadata: metadata || undefined
    };

    return this.transport.post<OAuthProviderConfig>(
      '/v1/auth/oauth/providers',
      body
    );
  }

  /**
   * Initiate OAuth login flow
   * Returns the authorization URL to redirect the user to
   */
  async initiateOAuthLogin(provider: string, redirectUri?: string): Promise<OAuthLoginResponse> {
    const params = redirectUri ? { redirect_uri: redirectUri } : undefined;
    return this.transport.get<OAuthLoginResponse>(
      `/v1/auth/oauth/${provider}/login`,
      { params, skipAuth: true }
    );
  }

  /**
   * Handle OAuth callback
   * Exchanges authorization code for API token
   */
  async handleOAuthCallback(
    provider: string,
    code: string,
    state: string
  ): Promise<User> {
    try {
      const response = await this.transport.get<LoginResponse>(
        `/v1/auth/oauth/${provider}/callback`,
        {
          params: { code, state },
          skipAuth: true
        }
      );

      // Save token
      const token: AuthToken = {
        access_token: response.access_token,
        token_type: response.token_type,
        expires_in: response.expires_in,
        user_id: response.user_id,
        role: response.role,
        created_at: Date.now()
      };
      AuthStore.saveToken(token);

      // Get user info
      const user = await this.getMe();
      AuthStore.saveUser(user);

      return user;
    } catch (error) {
      throw new CIRISAuthError(this.buildErrorMessage('OAuth callback', (error as Error).message));
    }
  }
}

// OAuth types
export interface OAuthProvider {
  provider: string;
  client_id: string;
  created: string;
  callback_url: string;
  metadata: Record<string, string>;
}

export interface OAuthProviderList {
  providers: OAuthProvider[];
}

export interface OAuthProviderConfig {
  provider: string;
  callback_url: string;
  message: string;
}

export interface OAuthLoginResponse {
  authorization_url: string;
  state: string;
}
