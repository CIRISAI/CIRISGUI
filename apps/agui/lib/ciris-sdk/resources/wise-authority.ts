// CIRIS TypeScript SDK - Wise Authority Resource

import { BaseResource } from './base';
import { PaginatedResponse } from '../types';

export interface Deferral {
  deferral_id: string;
  thought_id: string;
  question: string;
  context: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
  created_at: string;
  resolved_at?: string;
  resolution?: {
    decision: 'approve' | 'reject';
    reasoning: string;
    guidance?: string;
    resolved_by: string;
  };
  timeout_at: string;
}

export interface DeferralResolution {
  decision: 'approve' | 'reject';
  reasoning: string;
  guidance?: string;
}

export interface GuidanceRequest {
  topic: string;
  context?: Record<string, any>;
  urgency?: 'low' | 'medium' | 'high';
}

export interface GuidanceResponse {
  guidance_id: string;
  topic: string;
  guidance: string;
  confidence: number;
  sources: string[];
  created_at: string;
  context_used?: Record<string, any>;
}

export interface Permission {
  permission_id: string;
  resource: string;
  action: string;
  subject: string;
  granted: boolean;
  conditions?: Record<string, any>;
  expires_at?: string;
  created_at: string;
  created_by: string;
}

export interface WiseAuthorityStatus {
  service_name: string;
  status: 'active' | 'inactive' | 'degraded';
  deferrals_pending: number;
  deferrals_resolved_today: number;
  average_resolution_time_seconds: number;
  guidance_requests_today: number;
  permissions_active: number;
  last_activity?: string;
  wisdom_sources: Array<{
    name: string;
    type: string;
    status: 'connected' | 'disconnected';
    last_sync?: string;
  }>;
}

export class WiseAuthorityResource extends BaseResource {
  /**
   * Get all deferrals
   */
  async getDeferrals(params?: {
    page?: number;
    page_size?: number;
    status?: 'pending' | 'approved' | 'rejected' | 'timeout';
    start_date?: string;
    end_date?: string;
  }): Promise<Deferral[]> {
    const response = await this.transport.get<{
      deferrals: Deferral[];
      total: number;
    }>('/v1/wa/deferrals', params);
    return response.deferrals || [];
  }

  /**
   * Resolve a deferral
   */
  async resolveDeferral(
    deferralId: string,
    decision: string,
    reasoning: string,
    signature?: string
  ): Promise<{
    success: boolean;
    deferral_id: string;
    message: string;
    resolved_at: string;
  }> {
    // Map SDK fields to API fields
    const resolution = decision === 'deny' ? 'reject' : decision;
    return this.transport.post(
      `/v1/wa/deferrals/${deferralId}/resolve`,
      { resolution, guidance: reasoning }
    );
  }

  /**
   * Request guidance on a topic
   */
  async requestGuidance(request: GuidanceRequest): Promise<GuidanceResponse> {
    return this.transport.post<GuidanceResponse>('/v1/wa/guidance', request);
  }

  /**
   * Get permissions
   */
  async getPermissions(params?: {
    subject?: string;
    resource?: string;
    action?: string;
    granted?: boolean;
  }): Promise<Permission[]> {
    return this.transport.get<Permission[]>('/v1/wa/permissions', params);
  }

  /**
   * Get Wise Authority service status
   */
  async getStatus(): Promise<WiseAuthorityStatus> {
    return this.transport.get<WiseAuthorityStatus>('/v1/wa/status');
  }
}
