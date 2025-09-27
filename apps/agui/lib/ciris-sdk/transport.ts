// CIRIS TypeScript SDK - Transport Layer
// Handles HTTP requests with automatic response unwrapping

import { AuthStore } from './auth-store';
import { RateLimiter } from './rate-limiter';
import {
  CIRISAPIError,
  CIRISAuthError,
  CIRISConnectionError,
  CIRISTimeoutError,
  CIRISRateLimitError,
  CIRISPermissionDeniedError
} from './exceptions';
import { SuccessResponse, ErrorResponse } from './types';

export interface TransportOptions {
  baseURL: string;
  timeout?: number;
  maxRetries?: number;
  enableRateLimiting?: boolean;
  onAuthError?: () => void;
}

export class Transport {
  private baseURL: string;
  private timeout: number;
  private maxRetries: number;
  private rateLimiter?: RateLimiter;
  private onAuthError?: () => void;

  constructor(options: TransportOptions) {
    this.baseURL = options.baseURL.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = options.timeout || 60000; // 60 seconds default
    this.maxRetries = options.maxRetries || 3;
    this.onAuthError = options.onAuthError;

    if (options.enableRateLimiting) {
      this.rateLimiter = new RateLimiter(this.maxRetries);
    }
  }

  /**
   * Make an HTTP request with automatic retries and response unwrapping
   */
  async request<T = any>(
    method: string,
    path: string,
    options: {
      body?: any;
      params?: Record<string, any>;
      headers?: Record<string, string>;
      skipAuth?: boolean;
      responseType?: 'json' | 'blob' | 'text';
    } = {}
  ): Promise<T> {
    const url = this.buildURL(path, options.params);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Check rate limit
        if (this.rateLimiter) {
          const canProceed = await this.rateLimiter.checkLimit(path);
          if (!canProceed) {
            const delay = this.rateLimiter.getRetryDelay(attempt);
            await this.delay(delay);
            continue;
          }
        }

        // Build request
        const headers = this.buildHeaders(options.headers, options.skipAuth);
        const requestInit: RequestInit = {
          method,
          headers,
          signal: AbortSignal.timeout(this.timeout)
        };

        if (options.body && method !== 'GET') {
          requestInit.body = JSON.stringify(options.body);
          
          // Log consent requests for debugging
          if (path.includes('/consent/grant')) {
            console.log('[CIRIS SDK] Consent request payload:', {
              url: url,
              method: method,
              body: options.body,
              stringified: JSON.stringify(options.body)
            });
          }
        }

        // Make request
        const response = await fetch(url, requestInit);

        // Update rate limiter
        if (this.rateLimiter) {
          this.rateLimiter.updateFromHeaders(response.headers);
        }

        // Consume token after successful request
        if (this.rateLimiter) {
          this.rateLimiter.consumeToken(path);
        }

        // Handle response
        return await this.handleResponse<T>(response, options.responseType);

      } catch (error) {
        lastError = error as Error;

        // Don't retry on auth errors
        if (error instanceof CIRISAuthError) {
          throw error;
        }

        // Handle timeout
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new CIRISTimeoutError(`Request to ${path} timed out after ${this.timeout}ms`);
        }

        // Handle connection errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          lastError = new CIRISConnectionError(`Failed to connect to ${this.baseURL}`);
        }

        // Retry with backoff
        if (attempt < this.maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await this.delay(delay);
          continue;
        }
      }
    }

    throw lastError || new CIRISConnectionError('Request failed after retries');
  }

  /**
   * Handle HTTP response and unwrap v1 API format
   */
  private async handleResponse<T>(response: Response, responseType: 'json' | 'blob' | 'text' = 'json'): Promise<T> {
    // Handle 204 No Content
    if (response.status === 204) {
      return null as any;
    }

    // Handle auth errors
    if (response.status === 401) {
      console.error('401 Error Details:', {
        url: response.url,
        headers: Object.fromEntries(response.headers.entries()),
        status: response.status,
        statusText: response.statusText
      });

      // Try to get error details
      try {
        const errorData = await response.json();
        console.error('401 Error Response:', errorData);
      } catch (e) {
        console.error('Could not parse 401 error response');
      }

      AuthStore.clearToken();
      if (this.onAuthError) {
        this.onAuthError();
      }
      throw new CIRISAuthError('Authentication failed');
    }

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '100', 10);
      const window = response.headers.get('X-RateLimit-Window') || '1m';
      throw new CIRISRateLimitError(retryAfter, limit, window);
    }

    // Handle non-JSON responses first for successful responses
    if (response.ok && responseType !== 'json') {
      if (responseType === 'blob') {
        return await response.blob() as any;
      } else if (responseType === 'text') {
        return await response.text() as any;
      }
    }

    // Parse JSON response for error handling or JSON responses
    let data: any;
    let responseText: string = '';
    try {
      responseText = await response.text();
      data = responseText ? JSON.parse(responseText) : {};
    } catch (error) {
      // Log the parsing error and response details
      console.error('[CIRIS SDK] Failed to parse JSON response:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        responseText: responseText.substring(0, 500), // First 500 chars for debugging
        error: error
      });
      
      // If it's a successful response but we can't parse JSON
      if (response.ok) {
        // Check if it might be HTML (common for error pages)
        if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
          throw new CIRISAPIError(
            response.status,
            'Received HTML instead of JSON. The API endpoint may be incorrect or the server may be returning an error page.',
            responseText.substring(0, 200)
          );
        }
        // Return empty object for 200 OK with no content
        if (!responseText || responseText.trim() === '') {
          return {} as any;
        }
        throw new CIRISAPIError(
          response.status,
          'Failed to parse response as JSON',
          responseText.substring(0, 200)
        );
      }
      
      // For error responses, provide more context
      let errorMessage = `HTTP ${response.status} error`;
      
      // Try to extract meaningful error from HTML if present
      if (responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        // Try to extract title or body text from HTML
        const titleMatch = responseText.match(/<title>(.*?)<\/title>/i);
        if (titleMatch) {
          errorMessage = titleMatch[1];
        }
      } else if (responseText) {
        // Use the raw text if it's not HTML
        errorMessage = responseText.substring(0, 200);
      }
      
      throw new CIRISAPIError(
        response.status,
        errorMessage,
        'Response was not valid JSON. This might indicate the API is down, the endpoint is incorrect, or there is a server error.'
      );
    }

    // Handle errors
    if (!response.ok) {
      const errorData = data as ErrorResponse;

      // Log detailed error information for debugging
      if (response.status === 422) {
        console.error('[CIRIS SDK] 422 Validation Error:', {
          url: response.url,
          status: response.status,
          errorData: data,
          detail: errorData.detail,
          rawData: JSON.stringify(data)
        });
      }
      
      // Handle 422 validation errors with detail array
      if (response.status === 422 && Array.isArray(errorData.detail)) {
        // FastAPI/Pydantic validation errors come as an array of error objects
        const validationErrors = errorData.detail.map((err: any) => {
          // Each error has: loc (location), msg (message), type (error type), input (provided value)
          const location = Array.isArray(err.loc) ? err.loc.join('.') : err.loc;
          return `${location}: ${err.msg}`;
        }).join('; ');
        
        throw new CIRISAPIError(
          response.status,
          validationErrors || 'Validation error',
          validationErrors,
          'validation_error'
        );
      }

      // Handle enhanced 403 permission denied errors
      if (response.status === 403 && 'error' in data && data.error === 'insufficient_permissions') {
        console.log('[CIRIS SDK] Creating PermissionDeniedError with Discord invite:', {
          message: data.message || errorData.detail || 'Permission denied',
          discordInvite: data.discord_invite,
          canRequestPermissions: data.can_request_permissions,
          permissionRequested: data.permission_requested,
          requestedAt: data.requested_at
        });
        
        const permError = new CIRISPermissionDeniedError(
          data.message || errorData.detail || 'Permission denied',
          data.discord_invite,
          data.can_request_permissions,
          data.permission_requested,
          data.requested_at
        );
        
        console.log('[CIRIS SDK] Throwing PermissionDeniedError:', permError);
        throw permError;
      }

      throw new CIRISAPIError(
        response.status,
        errorData.detail || `HTTP ${response.status} error`,
        errorData.detail,
        errorData.type
      );
    }

    // Unwrap v1 API successful responses
    // The v1 API wraps all successful responses in { data: ..., metadata: ... }
    if (this.isSuccessResponse(data)) {
      // Log metadata in development
      if (process.env.NODE_ENV === 'development' && data.metadata) {
        console.debug(`[CIRIS SDK] Request took ${data.metadata.duration_ms}ms`, {
          request_id: data.metadata.request_id,
          timestamp: data.metadata.timestamp
        });
      }
      return data.data as T;
    }

    // For backward compatibility or non-standard endpoints
    return data as T;
  }

  /**
   * Check if response matches v1 API success format
   */
  private isSuccessResponse(data: any): data is SuccessResponse {
    return (
      typeof data === 'object' &&
      data !== null &&
      'data' in data &&
      'metadata' in data
    );
  }

  /**
   * Build full URL with query parameters
   */
  private buildURL(path: string, params?: Record<string, any>): string {
    let url: URL;

    // Check if path is already an absolute URL
    if (path.startsWith('http://') || path.startsWith('https://')) {
      url = new URL(path);
    } else {
      // Path is relative, combine with baseURL
      // Remove leading slash from path to ensure proper concatenation
      const cleanPath = path.startsWith('/') ? path.slice(1) : path;
      // Ensure baseURL ends with / for proper URL construction
      const base = this.baseURL.endsWith('/') ? this.baseURL : this.baseURL + '/';
      url = new URL(cleanPath, base);
    }

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    // Debug logging
    if (process.env.NODE_ENV === 'development') {
      console.log('[CIRIS SDK] Transport debug:', {
        baseURL: this.baseURL,
        path: path,
        finalURL: url.toString()
      });
    }

    return url.toString();
  }

  /**
   * Build request headers
   */
  private buildHeaders(
    customHeaders?: Record<string, string>,
    skipAuth?: boolean
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...customHeaders
    };

    // Add auth header if available
    if (!skipAuth) {
      const token = AuthStore.getAccessToken();
      // Ensure we never accidentally use the manager token
      if (token && typeof window !== 'undefined') {
        const managerToken = localStorage.getItem('manager_token');
        if (token === managerToken) {
          console.warn('[CIRIS SDK] Detected manager token, skipping auth for CIRIS SDK request');
          return headers; // Don't add auth header
        }
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Convenience methods
  async get<T = any>(path: string, options?: any): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  async post<T = any>(path: string, body?: any, options?: any): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  async put<T = any>(path: string, body?: any, options?: any): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  async patch<T = any>(path: string, body?: any, options?: any): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  async delete<T = any>(path: string, options?: any): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  /**
   * Update the base URL (for switching between agents)
   */
  setBaseURL(baseURL: string): void {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
    if (process.env.NODE_ENV === 'development') {
      console.log('[CIRIS SDK] Base URL updated to:', this.baseURL);
    }
  }

  /**
   * Get the current base URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * Update the auth token
   */
  setAuthToken(token: string | null): void {
    if (token) {
      // Don't override existing token metadata if we already have it
      const existing = AuthStore.getToken();
      if (existing && existing.access_token === token) {
        // Token is already saved with metadata
        return;
      }

      AuthStore.saveToken({
        access_token: token,
        token_type: 'Bearer',
        expires_in: 86400,
        user_id: '',
        role: '',
        created_at: Date.now()
      });

      if (process.env.NODE_ENV === 'development') {
        console.log('[CIRIS SDK] Auth token updated');
      }
    } else {
      AuthStore.clearToken();
    }
  }
}
