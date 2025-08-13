// CIRIS TypeScript SDK - Audit Resource

import { BaseResource } from './base';
import { AuditEntry, PaginatedResponse } from '../types';

export interface AuditSearchParams {
  service?: string;
  action?: string;
  user_id?: string;
  success?: boolean;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface AuditExportParams {
  format?: 'json' | 'csv';
  start_date?: string;
  end_date?: string;
  service?: string;
}

export interface AuditVerifyResponse {
  valid: boolean;
  entry_id: string;
  verification_details: {
    hash_valid: boolean;
    signature_valid: boolean;
    timestamp_valid: boolean;
    chain_valid: boolean;
  };
  message?: string;
}

export class AuditResource extends BaseResource {
  /**
   * Get all audit entries
   */
  async getEntries(params?: {
    page?: number;
    page_size?: number;
    service?: string;
    user_id?: string;
  }): Promise<PaginatedResponse<AuditEntry>> {
    const response = await this.transport.get<{ entries: AuditEntry[] }>('/v1/audit/entries', params);

    // Transform the response to match PaginatedResponse interface
    return {
      items: response.entries || [],
      total: response.entries?.length || 0,
      page: params?.page || 1,
      page_size: params?.page_size || 100,
      has_next: false,
      has_prev: false
    };
  }

  /**
   * Get a specific audit entry
   */
  async getEntry(entryId: string): Promise<AuditEntry> {
    return this.transport.get<AuditEntry>(`/v1/audit/entries/${entryId}`);
  }

  /**
   * Export audit entries
   */
  async exportEntries(params?: AuditExportParams): Promise<Blob> {
    const response = await this.transport.get('/v1/audit/export', {
      ...params,
      responseType: 'blob'
    });
    return response as Blob;
  }

  /**
   * Search audit entries
   */
  async searchEntries(params?: AuditSearchParams): Promise<PaginatedResponse<AuditEntry>> {
    return this.transport.post<PaginatedResponse<AuditEntry>>('/v1/audit/search', params || {});
  }

  /**
   * Verify an audit entry's integrity
   */
  async verifyEntry(entryId: string): Promise<AuditVerifyResponse> {
    return this.transport.get<AuditVerifyResponse>(`/v1/audit/verify/${entryId}`);
  }
}
