// CIRIS TypeScript SDK - System Resource

import { BaseResource } from './base';
import {
  HealthStatus,
  ServiceInfo,
  ResourceUsage,
  ProcessorQueueStatus,
  RuntimeControlExtendedResponse,
  ServiceHealthStatus,
  ServicePriorityUpdateRequest,
  CircuitBreakerResetRequest,
  ServiceSelectionExplanation,
  ProcessorStateInfo
} from '../types';

export interface RuntimeControlResponse {
  status: string;
  message: string;
  timestamp: string;
}


export interface AdapterInfo {
  adapter_id: string;
  adapter_type: string;
  is_running: boolean;
  channels: string[];
  message_count: number;
  error_count: number;
  created_at: string;
  last_activity?: string;
  config?: Record<string, any>;
}

export interface AdapterListResponse {
  adapters: AdapterInfo[];
  total_count: number;
  running_count: number;
}

export interface AdapterOperationResult {
  success: boolean;
  adapter_id?: string;
  message: string;
  adapter_type?: string;
}

export interface RegisterAdapterRequest {
  config?: Record<string, any>;
}

export class SystemResource extends BaseResource {
  /**
   * Get system health status
   */
  async getHealth(): Promise<HealthStatus> {
    return this.transport.get<HealthStatus>('/v1/system/health');
  }

  /**
   * Get all services status
   */
  async getServices(): Promise<{
    services: ServiceInfo[];
    total_services: number;
    healthy_services: number;
    timestamp: string;
  }> {
    return this.transport.get('/v1/system/services');
  }

  /**
   * Get resource usage
   */
  async getResources(): Promise<ResourceUsage> {
    return this.transport.get<ResourceUsage>('/v1/system/resources');
  }

  /**
   * Pause runtime processing
   */
  async pauseRuntime(): Promise<RuntimeControlResponse & { processor_state?: string; cognitive_state?: string }> {
    const response = await this.transport.post('/v1/system/runtime/pause', {});
    const data = response.data || response;
    return {
      status: data.success ? 'success' : 'error',
      message: data.message || 'Runtime paused',
      timestamp: response.metadata?.timestamp || new Date().toISOString(),
      processor_state: data.processor_state,
      cognitive_state: data.cognitive_state
    };
  }

  /**
   * Resume runtime processing
   */
  async resumeRuntime(): Promise<RuntimeControlResponse & { processor_state?: string; cognitive_state?: string }> {
    const response = await this.transport.post('/v1/system/runtime/resume', {});
    const data = response.data || response;
    return {
      status: data.success ? 'success' : 'error',
      message: data.message || 'Runtime resumed', 
      timestamp: response.metadata?.timestamp || new Date().toISOString(),
      processor_state: data.processor_state,
      cognitive_state: data.cognitive_state
    };
  }

  /**
   * Get runtime status
   */
  async getRuntimeStatus(): Promise<{
    is_paused: boolean;
    pause_reason?: string;
    paused_at?: string;
    paused_by?: string;
    processor_status?: string;
    health_status?: string;
    uptime_seconds?: number;
    active_adapters?: any[];
    loaded_adapters?: any[];
  }> {
    // Use the runtime state endpoint to get status
    const response = await this.transport.post('/v1/system/runtime/state', {});
    return {
      is_paused: response.processor_state === 'paused',
      processor_status: response.processor_state,
      health_status: 'healthy', // Not available in state endpoint
      uptime_seconds: 0, // Not available in state endpoint
      active_adapters: [],
      loaded_adapters: []
    };
  }

  /**
   * Get runtime state
   */
  async getRuntimeState(): Promise<{
    success: boolean;
    message: string;
    processor_state: string;
    cognitive_state: string;
    queue_depth: number;
  }> {
    try {
      // Get basic information from health and queue endpoints
      const [health, queue] = await Promise.all([
        this.transport.get('/v1/system/health').catch(() => null),
        this.transport.get('/v1/system/runtime/queue').catch(() => null)
      ]);
      
      const healthData = health?.data || health;
      const queueData = queue?.data || queue;
      
      // For now, we can only determine paused state from pause/resume operations
      // This method should be called after pause/resume to get current state
      // In normal query mode, we return 'running' as default since that's the normal state
      return {
        success: true,
        message: 'Runtime state retrieved',
        processor_state: 'running', // Default assumption - will be updated by mutations
        cognitive_state: healthData?.cognitive_state || 'work',
        queue_depth: queueData?.queue_size || 0
      };
    } catch (error: any) {
      return {
        success: false,
        message: 'Failed to retrieve runtime state',
        processor_state: 'unknown',
        cognitive_state: 'work',
        queue_depth: 0
      };
    }
  }


  /**
   * Pause a specific processor
   */
  async pauseProcessor(processorName: string, duration?: number): Promise<RuntimeControlResponse> {
    return this.transport.post<RuntimeControlResponse>(
      `/v1/system/processors/${processorName}/pause`,
      { duration }
    );
  }

  /**
   * Resume a specific processor
   */
  async resumeProcessor(processorName: string): Promise<RuntimeControlResponse> {
    return this.transport.post<RuntimeControlResponse>(
      `/v1/system/processors/${processorName}/resume`
    );
  }

  /**
   * Get all adapters
   */
  async getAdapters(): Promise<AdapterListResponse> {
    return this.transport.get<AdapterListResponse>('/v1/system/adapters');
  }

  /**
   * Get a specific adapter
   */
  async getAdapter(adapterId: string): Promise<AdapterInfo> {
    return this.transport.get<AdapterInfo>(`/v1/system/adapters/${adapterId}`);
  }

  /**
   * Register a new adapter
   */
  async registerAdapter(
    adapterType: string,
    config?: Record<string, any>
  ): Promise<AdapterOperationResult> {
    return this.transport.post<AdapterOperationResult>(
      `/v1/system/adapters/${adapterType}`,
      { config }
    );
  }

  /**
   * Unregister an adapter
   */
  async unregisterAdapter(adapterId: string): Promise<AdapterOperationResult> {
    return this.transport.delete<AdapterOperationResult>(
      `/v1/system/adapters/${adapterId}`
    );
  }

  /**
   * Reload an adapter
   */
  async reloadAdapter(adapterId: string): Promise<AdapterOperationResult> {
    return this.transport.put<AdapterOperationResult>(
      `/v1/system/adapters/${adapterId}/reload`
    );
  }

  /**
   * Restart a service
   */
  async restartService(serviceName: string): Promise<RuntimeControlResponse> {
    return this.transport.post<RuntimeControlResponse>(
      `/v1/system/services/${serviceName}/restart`
    );
  }

  /**
   * Pause an adapter
   */
  async pauseAdapter(adapterName: string, duration?: number): Promise<RuntimeControlResponse> {
    return this.transport.post<RuntimeControlResponse>(
      `/v1/system/adapters/${adapterName}/pause`,
      { duration }
    );
  }

  /**
   * Resume an adapter
   */
  async resumeAdapter(adapterName: string): Promise<RuntimeControlResponse> {
    return this.transport.post<RuntimeControlResponse>(
      `/v1/system/adapters/${adapterName}/resume`
    );
  }

  // Extended System Management Methods

  /**
   * Get processing queue status
   */
  async getProcessingQueueStatus(): Promise<ProcessorQueueStatus> {
    return this.transport.get<ProcessorQueueStatus>('/v1/system/runtime/queue');
  }

  /**
   * Execute a single processing step (basic)
   */
  async singleStepProcessor(): Promise<RuntimeControlExtendedResponse> {
    return this.transport.post<RuntimeControlExtendedResponse>('/v1/system/runtime/step');
  }

  /**
   * Execute a single processing step with enhanced detailed data
   */
  async singleStepProcessorEnhanced(includeDetails: boolean = true): Promise<import('../types').EnhancedSingleStepResponse> {
    const body = includeDetails ? { include_details: true } : {};
    const response = await this.transport.post('/v1/system/runtime/single-step', body);
    const data = response.data || response;
    
    // Transform the response to match expected format
    return {
      success: data.success || false,
      message: data.message || 'Single step completed',
      step_point: data.step_point || null,
      step_result: data.step_result || null,
      processing_time_ms: data.processing_time_ms || 0,
      tokens_used: data.tokens_used || 0,
      processor_state: data.processor_state || 'unknown',
      cognitive_state: data.cognitive_state || 'work',
      queue_depth: data.queue_depth || 0
    };
  }

  /**
   * Get detailed service health status
   */
  async getServiceHealthDetails(): Promise<ServiceHealthStatus> {
    return this.transport.get<ServiceHealthStatus>('/v1/system/services/health');
  }

  /**
   * Update service provider priority
   */
  async updateServicePriority(
    providerName: string,
    update: ServicePriorityUpdateRequest
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    return this.transport.put(
      `/v1/system/services/${providerName}/priority`,
      update
    );
  }

  /**
   * Reset circuit breakers
   */
  async resetCircuitBreakers(
    request: CircuitBreakerResetRequest = {}
  ): Promise<{ success: boolean; message?: string; reset_count?: number }> {
    return this.transport.post('/v1/system/services/circuit-breakers/reset', request);
  }

  /**
   * Get service selection logic explanation
   */
  async getServiceSelectionExplanation(): Promise<ServiceSelectionExplanation> {
    return this.transport.get<ServiceSelectionExplanation>('/v1/system/services/selection-logic');
  }

  /**
   * Get information about all processor states
   */
  async getProcessorStates(): Promise<ProcessorStateInfo[]> {
    return this.transport.get<ProcessorStateInfo[]>('/v1/system/processors');
  }

  /**
   * Get current system time
   */
  async getTime(): Promise<{
    current_time: string;
    timezone: string;
    timestamp: number;
  }> {
    return this.transport.get('/v1/system/time');
  }

  /**
   * Initiate system shutdown
   */
  async shutdown(reason: string, confirm: boolean = false, force: boolean = false): Promise<{
    status: string;
    message: string;
    shutdown_initiated: boolean;
  }> {
    return this.transport.post('/v1/system/shutdown', { reason, confirm, force });
  }

  /**
   * Get all available tools from all providers
   */
  async getTools(): Promise<{
    name: string;
    description: string;
    provider: string;
    schema: any;
    category: string;
  }[]> {
    return this.transport.get<{
      name: string;
      description: string;
      provider: string;
      schema: any;
      category: string;
    }[]>('/v1/system/tools');
  }
}
