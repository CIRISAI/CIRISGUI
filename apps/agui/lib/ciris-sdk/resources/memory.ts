// CIRIS TypeScript SDK - Memory Resource

import { BaseResource } from './base';
import { GraphNode, GraphEdge, MemoryOpResult } from '../types';

export interface MemoryStats {
  total_nodes: number;
  nodes_by_type: Record<string, number>;
  nodes_by_scope: Record<string, number>;
  oldest_memory?: string;
  newest_memory?: string;
}

export interface MemoryQueryOptions {
  type?: string;
  scope?: string;
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'updated_at' | 'relevance';
  order?: 'asc' | 'desc';
  include_edges?: boolean;
  depth?: number;
}

export class MemoryResource extends BaseResource {
  /**
   * Query memory nodes
   */
  async query(
    query: string,
    options: MemoryQueryOptions = {}
  ): Promise<GraphNode[]> {
    // If query looks like a node ID, search by ID
    const isNodeId = query && (
      // Known node type prefixes (case-insensitive)
      query.toLowerCase().startsWith('metric_') ||
      query.toLowerCase().startsWith('audit_') ||
      query.toLowerCase().startsWith('log_') ||
      query.toLowerCase().startsWith('dream_schedule_') ||
      query.toLowerCase().startsWith('thought_') ||
      query.toLowerCase().startsWith('thought/') ||  // Alternative thought format
      query.toLowerCase().startsWith('task_') ||
      query.toLowerCase().startsWith('observation_') ||
      query.toLowerCase().startsWith('concept_') ||
      query.toLowerCase().startsWith('identity_') ||
      query.toLowerCase().startsWith('config_') ||
      query.toLowerCase().startsWith('config:') ||  // Config nodes with colon format
      query.toLowerCase().startsWith('tsdb_data_') ||
      query.toLowerCase().startsWith('conversation_summary_') ||
      query.toLowerCase().startsWith('trace_summary_') ||
      query.toLowerCase().startsWith('audit_summary_') ||
      query.toLowerCase().startsWith('tsdb_summary_') ||
      query.toLowerCase().startsWith('user_') ||
      query.toLowerCase().startsWith('user/') ||  // User nodes with slash format
      query.toLowerCase().startsWith('shutdown_') ||
      query.toLowerCase().startsWith('edge_') ||
      query.toLowerCase().startsWith('datum-') ||  // Datum nodes
      // ISO timestamp patterns (with + or Z)
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(query) ||
      // Generic pattern: contains underscore (not at start) and 10-digit timestamp
      (query.includes('_') && !query.startsWith('_') && /\d{10}/.test(query))
    );

    const body: any = {
      ...(isNodeId ? { node_id: query } : { query }),
      ...options
    };

    // Debug logging
    console.log('Memory query:', { query, isNodeId, body });

    const response = await this.transport.post<any>('/v1/memory/query', body);
    console.log('Memory query response:', response);

    // Handle both direct array response and data wrapper
    return Array.isArray(response) ? response : (response.data || response);
  }

  /**
   * Get a specific memory node
   */
  async getNode(nodeId: string): Promise<GraphNode> {
    return this.transport.get<GraphNode>(`/v1/memory/${encodeURIComponent(nodeId)}`);
  }

  /**
   * Recall specific memory by ID (alternative to getNode)
   */
  async recall(nodeId: string): Promise<GraphNode> {
    return this.transport.get<GraphNode>(`/v1/memory/recall/${encodeURIComponent(nodeId)}`);
  }

  /**
   * Create a new memory node
   */
  async createNode(node: Omit<GraphNode, 'id' | 'version' | 'updated_at'>): Promise<MemoryOpResult> {
    return this.transport.post<MemoryOpResult>('/v1/memory/store', node);
  }

  /**
   * Update a memory node
   */
  async updateNode(
    nodeId: string,
    updates: Partial<GraphNode>
  ): Promise<MemoryOpResult> {
    return this.transport.patch<MemoryOpResult>(`/v1/memory/${encodeURIComponent(nodeId)}`, updates);
  }

  /**
   * Delete a memory node
   */
  async deleteNode(nodeId: string): Promise<MemoryOpResult> {
    return this.transport.delete<MemoryOpResult>(`/v1/memory/${encodeURIComponent(nodeId)}`);
  }

  /**
   * Get memory statistics
   */
  async getStats(): Promise<MemoryStats> {
    // Get memory stats from dedicated endpoint
    return this.transport.get<MemoryStats>('/v1/memory/stats');
  }

  /**
   * Search memories by semantic similarity
   */
  async search(
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      scope?: string;
    } = {}
  ): Promise<GraphNode[]> {
    const result = await this.transport.post<{
      results: GraphNode[];
      stats?: MemoryStats;
    }>('/v1/memory/query', {
      query,
      ...options
    });
    return result.results || [];
  }

  /**
   * Get memory timeline
   */
  async getTimeline(options: {
    start_time?: string;
    end_time?: string;
    bucket_size?: '1h' | '1d' | '1w' | '1m';
    scope?: string;
  } = {}): Promise<{
    memories: GraphNode[];
    buckets: Record<string, number>;
    total: number;
  }> {
    return this.transport.get('/v1/memory/timeline', { params: options });
  }

  /**
   * Get related memories
   */
  async getRelated(
    nodeId: string,
    options: {
      limit?: number;
      relationship_type?: string;
    } = {}
  ): Promise<GraphNode[]> {
    return this.transport.get<GraphNode[]>(`/v1/memory/${encodeURIComponent(nodeId)}/related`, {
      params: options
    });
  }

  /**
   * Get memory graph visualization as SVG
   */
  async getVisualization(options: {
    node_type?: string;
    scope?: 'local' | 'identity' | 'environment' | 'community';
    hours?: number;
    layout?: 'force' | 'timeline' | 'hierarchical';
    width?: number;
    height?: number;
    limit?: number;
    include_metrics?: boolean;
  } = {}): Promise<string> {
    // This returns SVG as text
    const response = await this.transport.get('/v1/memory/visualize/graph', {
      params: options,
      responseType: 'text'
    });
    return response as unknown as string;
  }

  /**
   * Create an edge between two nodes
   */
  async createEdge(edge: GraphEdge): Promise<MemoryOpResult> {
    return this.transport.post<MemoryOpResult>('/v1/memory/edges', { edge });
  }

  /**
   * Get all edges for a specific node
   */
  async getNodeEdges(nodeId: string, scope: string = 'local'): Promise<GraphEdge[]> {
    return this.transport.get<GraphEdge[]>(`/v1/memory/${encodeURIComponent(nodeId)}/edges`, {
      params: { scope }
    });
  }

  /**
   * Query nodes with edges included
   */
  async queryWithEdges(
    query: string,
    options: MemoryQueryOptions = {}
  ): Promise<GraphNode[]> {
    return this.query(query, { ...options, include_edges: true });
  }
}
