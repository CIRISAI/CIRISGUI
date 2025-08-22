/**
 * Consent Management Resource
 * Implements Consensual Evolution Protocol v0.2
 */

import { BaseResource } from '../base';

// Consent stream types
export enum ConsentStream {
  TEMPORARY = 'temporary',
  PARTNERED = 'partnered',
  ANONYMOUS = 'anonymous',
}

// Consent categories for PARTNERED stream
export enum ConsentCategory {
  INTERACTION = 'interaction',
  PREFERENCE = 'preference',
  IMPROVEMENT = 'improvement',
  RESEARCH = 'research',
  SHARING = 'sharing',
}

// Consent status response
export interface ConsentStatus {
  user_id: string;
  stream: ConsentStream;
  categories: ConsentCategory[];
  granted_at: string;
  expires_at?: string;
  last_modified: string;
  impact_score: number;
  attribution_count: number;
}

// Consent grant request
export interface ConsentRequest {
  stream: ConsentStream;
  categories: ConsentCategory[];
  reason?: string;
}

// Consent audit entry
export interface ConsentAuditEntry {
  entry_id: string;
  user_id: string;
  timestamp: string;
  previous_stream: ConsentStream;
  new_stream: ConsentStream;
  previous_categories: ConsentCategory[];
  new_categories: ConsentCategory[];
  initiated_by: string;
  reason?: string;
}

// Consent decay status
export interface ConsentDecayStatus {
  user_id: string;
  decay_started: string;
  identity_severed: boolean;
  patterns_anonymized: boolean;
  decay_complete_at: string;
  safety_patterns_retained: number;
}

// Consent impact report
export interface ConsentImpactReport {
  user_id: string;
  total_interactions: number;
  patterns_contributed: number;
  users_helped: number;
  categories_active: ConsentCategory[];
  impact_score: number;
  example_contributions: string[];
}

// Stream description
export interface ConsentStreamInfo {
  name: string;
  description: string;
  duration_days?: number;
  auto_forget: boolean;
  learning_enabled: boolean;
  identity_removed?: boolean;
  requires_categories?: boolean;
}

// Category description
export interface ConsentCategoryInfo {
  name: string;
  description: string;
}

// Partnership status response
export interface PartnershipStatus {
  current_stream: ConsentStream;
  partnership_status: 'pending' | 'accepted' | 'rejected' | 'deferred' | 'none';
  message: string;
}

// Streams response
export interface ConsentStreamsResponse {
  streams: Record<string, ConsentStreamInfo>;
  default: ConsentStream;
}

// Categories response
export interface ConsentCategoriesResponse {
  categories: Record<string, ConsentCategoryInfo>;
}

/**
 * Consent Management Resource
 * 
 * Handles user consent for data processing and retention.
 * Implements three-stream model: TEMPORARY, PARTNERED, ANONYMOUS.
 * 
 * @example
 * ```typescript
 * // Get current consent status
 * const status = await client.consent.getStatus();
 * 
 * // Request partnership
 * const result = await client.consent.grantConsent({
 *   stream: ConsentStream.PARTNERED,
 *   categories: [ConsentCategory.INTERACTION, ConsentCategory.PREFERENCE],
 *   reason: "I want to help improve the system"
 * });
 * 
 * // Check partnership status
 * const partnership = await client.consent.getPartnershipStatus();
 * 
 * // Get impact report
 * const impact = await client.consent.getImpactReport();
 * ```
 */
export class ConsentResource extends BaseResource {
  /**
   * Get current consent status for authenticated user
   * 
   * Returns default TEMPORARY (14-day) consent if none exists.
   * 
   * @returns Current consent status
   * @throws {Error} If not authenticated
   */
  async getStatus(): Promise<ConsentStatus> {
    return this.request<ConsentStatus>('/v1/consent/status', {
      method: 'GET',
    });
  }

  /**
   * Grant or update consent
   * 
   * Streams:
   * - TEMPORARY: 14-day auto-forget (default)
   * - PARTNERED: Explicit consent for mutual growth (requires agent approval)
   * - ANONYMOUS: Statistics only, no identity
   * 
   * @param request - Consent request with stream and categories
   * @returns Updated consent status
   * @throws {Error} If validation fails or not authenticated
   */
  async grantConsent(request: ConsentRequest): Promise<ConsentStatus> {
    return this.request<ConsentStatus>('/v1/consent/grant', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Revoke consent and start decay protocol
   * 
   * - Immediate identity severance
   * - 90-day pattern decay
   * - Safety patterns may be retained (anonymized)
   * 
   * @param reason - Optional reason for revocation
   * @returns Decay status information
   * @throws {Error} If no consent exists
   */
  async revokeConsent(reason?: string): Promise<ConsentDecayStatus> {
    return this.request<ConsentDecayStatus>('/v1/consent/revoke', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Get impact report showing contribution to collective learning
   * 
   * Only available for PARTNERED and ANONYMOUS users.
   * 
   * Shows:
   * - Patterns contributed
   * - Users helped
   * - Impact score
   * - Example contributions (anonymized)
   * 
   * @returns Impact report with metrics
   * @throws {Error} If no consent data found
   */
  async getImpactReport(): Promise<ConsentImpactReport> {
    return this.request<ConsentImpactReport>('/v1/consent/impact', {
      method: 'GET',
    });
  }

  /**
   * Get consent change history - IMMUTABLE AUDIT TRAIL
   * 
   * @param limit - Maximum number of entries to return (default: 100)
   * @returns List of audit entries
   */
  async getAuditTrail(limit: number = 100): Promise<ConsentAuditEntry[]> {
    return this.request<ConsentAuditEntry[]>(`/v1/consent/audit?limit=${limit}`, {
      method: 'GET',
    });
  }

  /**
   * Get available consent streams and their descriptions
   * 
   * @returns Stream information and default stream
   */
  async getStreams(): Promise<ConsentStreamsResponse> {
    return this.request<ConsentStreamsResponse>('/v1/consent/streams', {
      method: 'GET',
    });
  }

  /**
   * Get available consent categories for PARTNERED stream
   * 
   * @returns Category information
   */
  async getCategories(): Promise<ConsentCategoriesResponse> {
    return this.request<ConsentCategoriesResponse>('/v1/consent/categories', {
      method: 'GET',
    });
  }

  /**
   * Check status of pending partnership request
   * 
   * Returns current status and any pending partnership request outcome.
   * Poll this endpoint when partnership_status is "pending".
   * 
   * @returns Partnership status information
   */
  async getPartnershipStatus(): Promise<PartnershipStatus> {
    return this.request<PartnershipStatus>('/v1/consent/partnership/status', {
      method: 'GET',
    });
  }

  /**
   * Clean up expired TEMPORARY consents (admin only)
   * 
   * HARD DELETE after 14 days - NO GRACE PERIOD.
   * 
   * @returns Number of cleaned records
   * @throws {Error} If not admin
   */
  async cleanupExpired(): Promise<{ cleaned: number; message: string }> {
    return this.request<{ cleaned: number; message: string }>('/v1/consent/cleanup', {
      method: 'POST',
    });
  }

  /**
   * Helper: Request partnership with selected categories
   * 
   * @param categories - Categories to consent to
   * @param reason - Reason for partnership request
   * @returns Consent status (will still be current stream until approved)
   */
  async requestPartnership(
    categories: ConsentCategory[],
    reason?: string
  ): Promise<ConsentStatus> {
    return this.grantConsent({
      stream: ConsentStream.PARTNERED,
      categories,
      reason: reason || 'User requested partnership upgrade',
    });
  }

  /**
   * Helper: Switch to TEMPORARY consent
   * 
   * @returns Updated consent status
   */
  async switchToTemporary(): Promise<ConsentStatus> {
    return this.grantConsent({
      stream: ConsentStream.TEMPORARY,
      categories: [],
      reason: 'User switched to temporary consent',
    });
  }

  /**
   * Helper: Switch to ANONYMOUS consent
   * 
   * @returns Updated consent status
   */
  async switchToAnonymous(): Promise<ConsentStatus> {
    return this.grantConsent({
      stream: ConsentStream.ANONYMOUS,
      categories: [],
      reason: 'User switched to anonymous consent',
    });
  }

  /**
   * Helper: Check if user has active partnership
   * 
   * @returns True if user has PARTNERED consent
   */
  async hasPartnership(): Promise<boolean> {
    const status = await this.getStatus();
    return status.stream === ConsentStream.PARTNERED;
  }

  /**
   * Helper: Get remaining time for TEMPORARY consent
   * 
   * @returns Remaining time in milliseconds, or null if not TEMPORARY
   */
  async getTimeRemaining(): Promise<number | null> {
    const status = await this.getStatus();
    if (status.stream !== ConsentStream.TEMPORARY || !status.expires_at) {
      return null;
    }
    
    const expiresAt = new Date(status.expires_at).getTime();
    const now = Date.now();
    return Math.max(0, expiresAt - now);
  }

  /**
   * Helper: Poll for partnership decision
   * 
   * Polls every 5 seconds until partnership is accepted/rejected.
   * 
   * @param onStatusChange - Callback for status changes
   * @param maxAttempts - Maximum polling attempts (default: 60 = 5 minutes)
   * @returns Final partnership status
   */
  async pollPartnershipStatus(
    onStatusChange?: (status: PartnershipStatus) => void,
    maxAttempts: number = 60
  ): Promise<PartnershipStatus> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const status = await this.getPartnershipStatus();
      
      if (onStatusChange) {
        onStatusChange(status);
      }
      
      if (status.partnership_status !== 'pending') {
        return status;
      }
      
      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }
    
    // Return final status after max attempts
    return this.getPartnershipStatus();
  }
}