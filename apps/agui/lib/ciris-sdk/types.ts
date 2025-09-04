// CIRIS TypeScript SDK - Type Definitions
// Mirrors the Python SDK models for consistency

// Role Types
export type APIRole = 'OBSERVER' | 'ADMIN' | 'AUTHORITY' | 'SYSTEM_ADMIN';
export type WARole = 'observer' | 'admin' | 'authority' | 'root';

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
  signature?: string;
  hash_chain?: string;
  storage_sources: string[];
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

// Enhanced Single-Step Types
export enum StepPoint {
  FINALIZE_TASKS_QUEUE = 'finalize_tasks_queue',
  POPULATE_THOUGHT_QUEUE = 'populate_thought_queue',
  POPULATE_ROUND = 'populate_round',
  BUILD_CONTEXT = 'build_context',
  PERFORM_DMAS = 'perform_dmas',
  PERFORM_ASPDMA = 'perform_aspdma',
  CONSCIENCE_EXECUTION = 'conscience_execution',
  RECURSIVE_ASPDMA = 'recursive_aspdma',
  RECURSIVE_CONSCIENCE = 'recursive_conscience',
  ACTION_SELECTION = 'action_selection',
  HANDLER_START = 'handler_start',
  BUS_OUTBOUND = 'bus_outbound',
  PACKAGE_HANDLING = 'package_handling',
  BUS_INBOUND = 'bus_inbound',
  HANDLER_COMPLETE = 'handler_complete'
}

// Queue and Task Types
export interface QueuedTask {
  task_id: string;
  priority: string;
  channel: string;
  content: string;
  created_at: string;
}

export interface QueuedThought {
  thought_id: string;
  task_id: string;
  thought_type: string;
  priority: number;
  content: string;
  created_at: string;
}

export interface ThoughtInPipeline {
  thought_id: string;
  task_id: string;
  thought_type: string;
  current_step: string;
  entered_step_at: string;
  processing_time_ms: number;
}

// DMA Result Types
export interface EthicalDMAResult {
  ethical_assessment: string;
  concerns: string[];
  recommendations: string[];
  confidence_level: number;
}

export interface CSDMAResult {
  common_sense_assessment: string;
  practical_considerations: string[];
  potential_issues: string[];
  confidence_level: number;
}

export interface DSDMAResult {
  domain_specific_assessment: string;
  domain_knowledge_applied: string[];
  domain_constraints: string[];
  confidence_level: number;
}

export interface ActionSelectionDMAResult {
  selected_action: string;
  action_parameters: Record<string, any>;
  reasoning: string;
  confidence_level: number;
}

export interface ConscienceResult {
  conscience_name: string;
  passed: boolean;
  reasoning: string;
  recommendations: string[];
}

// Step Result Schemas
export interface StepResultFinalizeTasksQueue {
  step_point: StepPoint.FINALIZE_TASKS_QUEUE;
  success: boolean;
  thought_id: string;
  tasks_to_process: QueuedTask[];
  tasks_deferred: Record<string, string>;
  selection_criteria: Record<string, any>;
  total_pending_tasks: number;
  total_active_tasks: number;
  tasks_selected_count: number;
  round_number: number;
  current_state: string;
  processing_time_ms: number;
}

export interface StepResultPopulateThoughtQueue {
  step_point: StepPoint.POPULATE_THOUGHT_QUEUE;
  success: boolean;
  thought_id: string;
  thoughts_generated: QueuedThought[];
  task_thought_mapping: Record<string, string[]>;
  thoughts_per_task: Record<string, number>;
  generation_errors: string[];
  total_thoughts_generated: number;
  processing_time_ms: number;
}

export interface StepResultPopulateRound {
  step_point: StepPoint.POPULATE_ROUND;
  success: boolean;
  thought_id: string;
  thoughts_for_round: ThoughtInPipeline[];
  thoughts_deferred: Record<string, string>;
  batch_size: number;
  priority_threshold: number;
  remaining_in_queue: number;
  processing_time_ms: number;
}

export interface StepResultBuildContext {
  step_point: StepPoint.BUILD_CONTEXT;
  success: boolean;
  thought_id: string;
  system_snapshot: Record<string, any>;
  agent_identity: Record<string, any>;
  thought_context: Record<string, any>;
  channel_context: Record<string, any>;
  memory_context: Record<string, any>;
  permitted_actions: string[];
  constraints: string[];
  context_size_bytes: number;
  memory_queries_performed: number;
  processing_time_ms: number;
}

export interface StepResultPerformDMAs {
  step_point: StepPoint.PERFORM_DMAS;
  success: boolean;
  thought_id: string;
  ethical_dma: EthicalDMAResult;
  common_sense_dma: CSDMAResult;
  domain_dma: DSDMAResult;
  dmas_executed: string[];
  dma_failures: Record<string, string>;
  longest_dma_time_ms: number;
  total_time_ms: number;
  processing_time_ms: number;
}

export interface StepResultPerformASPDMA {
  step_point: StepPoint.PERFORM_ASPDMA;
  success: boolean;
  thought_id: string;
  prompt_text: string;
  llm_model: string;
  raw_response: string;
  aspdma_result: ActionSelectionDMAResult;
  tokens_used: number;
  retry_count: number;
  processing_time_ms: number;
}

export interface StepResultConscienceExecution {
  step_point: StepPoint.CONSCIENCE_EXECUTION;
  success: boolean;
  thought_id: string;
  aspdma_result: ActionSelectionDMAResult;
  conscience_evaluations: ConscienceResult[];
  all_passed: boolean;
  failures: string[];
  override_required: boolean;
  longest_conscience_time_ms: number;
  total_time_ms: number;
  processing_time_ms: number;
}

export interface StepResultRecursiveASPDMA {
  step_point: StepPoint.RECURSIVE_ASPDMA;
  success: boolean;
  thought_id: string;
  original_action: string;
  conscience_feedback: string;
  recursion_count: number;
  retry_prompt: string;
  raw_response: string;
  new_aspdma_result: ActionSelectionDMAResult;
  processing_time_ms: number;
}

export interface StepResultRecursiveConscience {
  step_point: StepPoint.RECURSIVE_CONSCIENCE;
  success: boolean;
  thought_id: string;
  is_recursive: boolean;
  recursion_count: number;
  aspdma_result: ActionSelectionDMAResult;
  conscience_evaluations: ConscienceResult[];
  all_passed: boolean;
  failures: string[];
  final_override_to_ponder: boolean;
  processing_time_ms: number;
}

export interface StepResultActionSelection {
  step_point: StepPoint.ACTION_SELECTION;
  success: boolean;
  thought_id: string;
  final_action_result: ActionSelectionDMAResult;
  was_overridden: boolean;
  override_reason: string;
  recursion_performed: boolean;
  target_handler: string;
  processing_time_ms: number;
}

export interface StepResultHandlerStart {
  step_point: StepPoint.HANDLER_START;
  success: boolean;
  thought_id: string;
  handler_name: string;
  action_type: string;
  action_parameters: Record<string, any>;
  handler_context: Record<string, any>;
  expected_bus_operations: string[];
  processing_time_ms: number;
}

export interface StepResultBusOutbound {
  step_point: StepPoint.BUS_OUTBOUND;
  success: boolean;
  thought_id: string;
  buses_called: string[];
  communication_bus: Record<string, any>;
  memory_bus: Record<string, any>;
  tool_bus: Record<string, any>;
  operations_initiated: string[];
  awaiting_responses: string[];
  processing_time_ms: number;
}

export interface StepResultPackageHandling {
  step_point: StepPoint.PACKAGE_HANDLING;
  success: boolean;
  thought_id: string;
  adapter_name: string;
  package_type: string;
  external_service_called: string;
  external_response_received: boolean;
  package_transformed: boolean;
  transformation_details: Record<string, any>;
  processing_time_ms: number;
}

export interface StepResultBusInbound {
  step_point: StepPoint.BUS_INBOUND;
  success: boolean;
  thought_id: string;
  responses_received: Record<string, any>;
  communication_response: Record<string, any>;
  memory_response: Record<string, any>;
  tool_response: Record<string, any>;
  responses_aggregated: boolean;
  final_result: Record<string, any>;
  processing_time_ms: number;
}

export interface StepResultHandlerComplete {
  step_point: StepPoint.HANDLER_COMPLETE;
  success: boolean;
  thought_id: string;
  handler_success: boolean;
  handler_message: string;
  handler_data: Record<string, any>;
  thought_final_status: string;
  task_status_update: string;
  total_processing_time_ms: number;
  total_tokens_used: number;
  triggers_new_thoughts: boolean;
  triggered_thought_ids: string[];
  processing_time_ms: number;
}

// Union type for all step results
export type StepResult = 
  | StepResultFinalizeTasksQueue
  | StepResultPopulateThoughtQueue
  | StepResultPopulateRound
  | StepResultBuildContext
  | StepResultPerformDMAs
  | StepResultPerformASPDMA
  | StepResultConscienceExecution
  | StepResultRecursiveASPDMA
  | StepResultRecursiveConscience
  | StepResultActionSelection
  | StepResultHandlerStart
  | StepResultBusOutbound
  | StepResultPackageHandling
  | StepResultBusInbound
  | StepResultHandlerComplete;

// Pipeline State
export interface PipelineState {
  is_paused: boolean;
  current_round: number;
  thoughts_by_step: Record<string, ThoughtInPipeline[]>;
  task_queue: QueuedTask[];
  thought_queue: QueuedThought[];
  total_thoughts_processed: number;
  total_thoughts_in_flight: number;
}

// Enhanced Single-Step Response
export interface EnhancedSingleStepResponse {
  success: boolean;
  message: string;
  processor_state: string;
  cognitive_state?: string;
  queue_depth: number;
  step_point?: StepPoint;
  step_result?: StepResult;
  pipeline_state?: PipelineState;
  processing_time_ms?: number;
  tokens_used?: number;
  demo_data?: Record<string, any>;
}
