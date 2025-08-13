// CIRIS TypeScript SDK - Telemetry Resource

import { BaseResource } from './base';
import { PaginatedResponse } from '../types';

export interface TelemetryLog {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  service: string;
  message: string;
  context?: Record<string, any>;
  trace_id?: string;
  span_id?: string;
}

export interface TelemetryMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  labels?: Record<string, string>;
  description?: string;
}

export interface MetricDetail {
  name: string;
  description: string;
  unit: string;
  type: 'counter' | 'gauge' | 'histogram';
  current_value: number;
  statistics: {
    min: number;
    max: number;
    mean: number;
    count: number;
  };
  recent_values: Array<{
    timestamp: string;
    value: number;
  }>;
}

export interface TelemetryOverview {
  uptime_seconds: number;
  cognitive_state: string;
  messages_processed_24h: number;
  thoughts_processed_24h: number;
  tasks_completed_24h: number;
  errors_24h: number;
  tokens_last_hour: number;
  cost_last_hour_cents: number;
  carbon_last_hour_grams: number;
  energy_last_hour_kwh: number;
  tokens_24h: number;
  cost_24h_cents: number;
  carbon_24h_grams: number;
  energy_24h_kwh: number;
  memory_mb: number;
  cpu_percent: number;
  healthy_services: number;
  degraded_services: number;
  error_rate_percent: number;
  current_task: string | null;
  reasoning_depth: number;
  active_deferrals: number;
  recent_incidents: number;
  total_metrics: number;
  active_services: number;
}

export interface TelemetryQuery {
  service?: string;
  level?: string;
  start_time?: string;
  end_time?: string;
  search?: string;
  metric_names?: string[];
  aggregation?: 'min' | 'max' | 'avg' | 'sum';
  group_by?: string;
  interval?: string;
}

export interface TelemetryQueryResult {
  query: TelemetryQuery;
  results: Array<{
    timestamp: string;
    data: Record<string, any>;
  }>;
  total_count: number;
  execution_time_ms: number;
}

export interface ResourceHistory {
  timestamp: string;
  cpu_percent: number;
  memory_mb: number;
  memory_percent: number;
  disk_usage_gb?: number;
  network_io?: {
    bytes_sent: number;
    bytes_recv: number;
  };
  active_connections?: number;
}

export interface TelemetryTrace {
  trace_id: string;
  root_span_id: string;
  service: string;
  operation: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  status: 'ok' | 'error';
  spans_count: number;
  error_count: number;
  tags?: Record<string, string>;
}

export class TelemetryResource extends BaseResource {
  /**
   * Get telemetry logs (overloaded for backward compatibility)
   */
  async getLogs(level?: string, service?: string, limit?: number): Promise<TelemetryLog[]>;
  async getLogs(params?: {
    page?: number;
    page_size?: number;
    service?: string;
    level?: string;
    start_time?: string;
    end_time?: string;
    search?: string;
  }): Promise<PaginatedResponse<TelemetryLog>>;
  async getLogs(
    levelOrParams?: string | {
      page?: number;
      page_size?: number;
      service?: string;
      level?: string;
      start_time?: string;
      end_time?: string;
      search?: string;
    },
    service?: string,
    limit?: number
  ): Promise<TelemetryLog[] | PaginatedResponse<TelemetryLog>> {
    // Handle old signature (level, service, limit)
    if (typeof levelOrParams === 'string' || levelOrParams === undefined) {
      const response = await this.transport.get<{
        logs: TelemetryLog[];
        total: number;
        has_more: boolean;
      }>('/v1/telemetry/logs', {
        params: {
          level: levelOrParams,
          service: service,
          limit: limit || 100
        }
      });
      return response.logs || [];
    }

    // Handle new signature with params object
    return this.transport.get<PaginatedResponse<TelemetryLog>>('/v1/telemetry/logs', levelOrParams);
  }

  /**
   * Get telemetry metrics
   */
  async getMetrics(params?: {
    page?: number;
    page_size?: number;
    name?: string;
    service?: string;
    start_time?: string;
    end_time?: string;
  }): Promise<PaginatedResponse<TelemetryMetric>> {
    return this.transport.get<PaginatedResponse<TelemetryMetric>>('/v1/telemetry/metrics', params);
  }

  /**
   * Get detailed information about a specific metric
   */
  async getMetricDetail(metricName: string): Promise<MetricDetail> {
    return this.transport.get<MetricDetail>(`/v1/telemetry/metrics/${metricName}`);
  }

  /**
   * Get telemetry overview
   */
  async getOverview(params?: {
    start_time?: string;
    end_time?: string;
  }): Promise<TelemetryOverview> {
    return this.transport.get<TelemetryOverview>('/v1/telemetry/overview', params);
  }

  /**
   * Query telemetry data
   */
  async query(query: TelemetryQuery): Promise<TelemetryQueryResult> {
    return this.transport.post<TelemetryQueryResult>('/v1/telemetry/query', query);
  }

  /**
   * Get current resource usage
   */
  async getResources(): Promise<{
    cpu_percent: number;
    memory_mb: number;
    memory_percent: number;
    disk_usage_gb?: number;
    network_io?: {
      bytes_sent: number;
      bytes_recv: number;
    };
    active_connections?: number;
    timestamp: string;
  }> {
    return this.transport.get('/v1/telemetry/resources');
  }

  /**
   * Get resource usage history
   */
  async getResourceHistory(params?: {
    start_time?: string;
    end_time?: string;
    interval?: string;
  }): Promise<ResourceHistory[]> {
    return this.transport.get<ResourceHistory[]>('/v1/telemetry/resources/history', params);
  }

  /**
   * Get telemetry traces
   */
  async getTraces(params?: {
    page?: number;
    page_size?: number;
    service?: string;
    status?: 'ok' | 'error';
    start_time?: string;
    end_time?: string;
  }): Promise<PaginatedResponse<TelemetryTrace>> {
    return this.transport.get<PaginatedResponse<TelemetryTrace>>('/v1/telemetry/traces', params);
  }

  /**
   * Get incidents (logs with severity error or critical)
   */
  async getIncidents(params?: {
    limit?: number;
    resolved?: boolean;
    service?: string;
  }): Promise<TelemetryLog[]> {
    const response = await this.transport.get<{
      logs: TelemetryLog[];
      total: number;
      has_more: boolean;
    }>('/v1/telemetry/logs', {
      params: {
        level: 'ERROR',
        limit: params?.limit || 50,
        service: params?.service
      }
    });
    return response.logs || [];
  }
}
