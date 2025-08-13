// CIRIS TypeScript SDK - Type Definitions
// Mirrors the Python SDK models for consistency

// Role Types
export type APIRole = 'OBSERVER' | 'ADMIN' | 'AUTHORITY' | 'SYSTEM_ADMIN';
export type WARole = 'OBSERVER' | 'ADMIN' | 'AUTHORITY';

// Base Types
export interface User {
  user_id: string;
  username: string;
  role: APIRole;  // For backward compatibility
  api_role: APIRole;
  wa_role?: WARole;
  permissions: string[];
  created_at: string;
  last_login?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  role: string;
}

// Agent Types
export interface AgentStatus {
  agent_id: string;
  name: string;
  cognitive_state: string;
  uptime_seconds: number;
  messages_processed: number;
  last_activity: string;
  current_task?: any;
  services_active: number;
  memory_usage_mb: number;
  version: string;  // e.g., "1.0.4-beta"
  codename: string; // e.g., "Graceful Guardian"
  code_hash?: string; // Optional code hash for exact version
}

export interface AgentIdentity {
  agent_id: string;
  name: string;
  purpose: string;
  created_at: string;
  lineage: {
    model: string;
    version: string;
    parent_id?: string;
    creation_context: string;
    adaptations: string[];
  };
  variance_threshold: number;
  tools: string[];
  handlers: string[];
  services: {
    graph: number;
    core: number;
    infrastructure: number;
    governance: number;
    special: number;
  };
  permissions: string[];
}

export interface InteractResponse {
  response: string;
  processing_time_ms: number;
  cognitive_state: string;
  timestamp: string;
}

// Memory Types
export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
  scope: string;
  weight: number;
  attributes?: Record<string, any>;
}

export interface GraphNode {
  id: string;
  type: string;
  scope: string;
  attributes: Record<string, any>;
  version: number;
  updated_by?: string;
  updated_at?: string;
  // Edges are included in attributes._edges when include_edges=true in query
}

export interface MemoryOpResult {
  success: boolean;
  node_id?: string;
  message?: string;
  error?: string;
}

// System Types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime_seconds: number;
  services: Record<string, ServiceHealth>;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  last_check: string;
}

export interface ServiceInfo {
  name: string;
  type: string;
  status: 'running' | 'stopped' | 'error';
  health: ServiceHealth;
  created_at: string;
  config?: Record<string, any>;
}

export interface ResourceUsage {
  current_usage: {
    memory_mb: number;
    memory_percent: number;
    cpu_percent: number;
    cpu_average_1m: number;
    tokens_used_hour: number;
    tokens_used_day: number;
    disk_used_mb: number;
    disk_free_mb: number;
    thoughts_active: number;
    thoughts_queued: number;
    healthy: boolean;
    warnings: string[];
    critical: string[];
  };
  limits: {
    memory_mb: ResourceLimit;
    cpu_percent: ResourceLimit;
    tokens_hour: ResourceLimit;
    tokens_day: ResourceLimit;
    disk_mb: ResourceLimit;
    thoughts_active: ResourceLimit;
  };
  health_status: string;
  warnings: string[];
  critical: string[];
}

export interface ResourceLimit {
  limit: number;
  warning: number;
  critical: number;
  action: string;
  cooldown_seconds: number;
}

// Conversation Types
export interface ConversationMessage {
  id: string;
  content: string;
  author: string;
  author_id: string;
  channel_id: string;
  timestamp: string;
  is_agent: boolean;
}

export interface ConversationHistory {
  messages: ConversationMessage[];
  total_count: number;
  has_more: boolean;
}

// Audit Types
export interface AuditEntry {
  id: string;
  timestamp: string;
  service: string;
  action: string;
  user_id?: string;
  details: Record<string, any>;
  success: boolean;
  error?: string;
}

// Config Types
export interface ConfigData {
  [key: string]: any;
}

// WebSocket Types
export interface WSMessage {
  type: string;
  channel?: string;
  data?: any;
}

export interface WSEvent {
  event: string;
  channel: string;
  data: any;
  timestamp: string;
}

// Telemetry Types
export interface TelemetryMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  labels?: Record<string, string>;
  description?: string;
}

// API Response Types
export interface SuccessResponse<T = any> {
  data: T;
  metadata: {
    timestamp: string;
    request_id?: string;
    duration_ms?: number;
  };
}

export interface ErrorResponse {
  detail: string;
  status?: number;
  type?: string;
}

// Enhanced error response for 403 Forbidden errors
export interface PermissionDeniedError extends ErrorResponse {
  error: 'insufficient_permissions';
  message: string;
  discord_invite?: string;
  can_request_permissions?: boolean;
  permission_requested?: boolean;
  requested_at?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_prev: boolean;
}

// Rate Limiting
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  window: string;
}

// Emergency Types
export interface EmergencyShutdownRequest {
  reason: string;
  signature: string;
  initiator: string;
}

export interface EmergencyShutdownResponse {
  status: string;
  shutdown_id: string;
  initiated_at: string;
  services_stopped: number;
}

// Extended System Types
export interface ProcessorQueueStatus {
  processor_name: string;
  queue_size: number;
  max_size: number;
  processing_rate?: number;
  average_latency_ms?: number;
  oldest_message_age_seconds?: number;
}

export interface RuntimeControlExtendedResponse {
  success: boolean;
  message: string;
  processor_state: string;
  cognitive_state?: string;
  queue_depth: number;
}

export interface ServiceHealthStatus {
  overall_health: string;
  healthy_services: string[];
  unhealthy_services: string[];
  service_details: Record<string, any>;
  recommendations: string[];
}

export interface ServicePriorityUpdateRequest {
  priority: string;
  priority_group?: number;
  strategy?: string;
}

export interface CircuitBreakerResetRequest {
  service_type?: string;
}

export interface ServiceSelectionExplanation {
  overview: string;
  priority_groups: Record<string, string>;
  priorities: Record<string, any>;
  selection_strategies: Record<string, any>;
  selection_flow: string[];
  circuit_breaker_info: Record<string, any>;
}

export interface ProcessorStateInfo {
  name: string;
  is_active: boolean;
  description: string;
  capabilities: string[];
}
