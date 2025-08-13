// CIRIS TypeScript SDK - Emergency Resource

import { BaseResource } from './base';
import { EmergencyShutdownRequest, EmergencyShutdownResponse } from '../types';

export interface EmergencyTestResponse {
  test_successful: boolean;
  message: string;
  timestamp: string;
  services_checked: number;
  warnings: string[];
}

export class EmergencyResource extends BaseResource {
  /**
   * Initiate emergency shutdown
   * WARNING: This will immediately stop all agent operations
   */
  async shutdown(request: EmergencyShutdownRequest): Promise<EmergencyShutdownResponse> {
    return this.transport.post<EmergencyShutdownResponse>(
      '/emergency/shutdown',
      request,
      {
        // Emergency endpoints don't require standard auth
        skipAuth: true,
        headers: {
          'X-Emergency-Signature': request.signature
        }
      }
    );
  }

  /**
   * Test emergency systems without triggering actual shutdown
   */
  async test(): Promise<EmergencyTestResponse> {
    return this.transport.get<EmergencyTestResponse>('/emergency/test');
  }
}
