'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cirisClient } from '../../lib/ciris-sdk';
import { GraphNode } from '../../lib/ciris-sdk/types';
import toast from 'react-hot-toast';
import { debounce } from 'lodash';
import { SpinnerIcon } from '../../components/Icons';

interface MemoryStats {
  total_nodes: number;
  nodes_by_type: Record<string, number>;
  nodes_by_scope: Record<string, number>;
  total_relationships: number;
  memory_size_bytes: number;
  oldest_node: string;
  newest_node: string;
}

const NODE_TYPES = ['concept', 'observation', 'identity', 'config', 'tsdb_data', 'audit_entry'];
const SCOPES = [
  { value: 'local', label: 'LOCAL' },
  { value: 'identity', label: 'IDENTITY' },
  { value: 'environment', label: 'ENVIRONMENT' },
  { value: 'community', label: 'COMMUNITY' }
];
const LAYOUTS = ['force', 'timeline', 'hierarchical'] as const;

export default function MemoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingNode, setIsLoadingNode] = useState(false);
  const [activeScope, setActiveScope] = useState<string>('local');
  const [activeNodeType, setActiveNodeType] = useState<string | null>(null);
  const [graphLayout, setGraphLayout] = useState<'force' | 'timeline' | 'hierarchical'>('timeline');
  const [timeRange, setTimeRange] = useState<number>(168);
  const [showVisualization, setShowVisualization] = useState(true);
  const [includeMetrics, setIncludeMetrics] = useState(false);
  const [maxNodes, setMaxNodes] = useState<number>(1000);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch visualization
  const { data: svgContent, isLoading: vizLoading, refetch: refetchViz } = useQuery<string>({
    queryKey: ['memory-visualization', activeScope, activeNodeType, graphLayout, timeRange, includeMetrics, maxNodes],
    queryFn: async () => {
      return await cirisClient.memory.getVisualization({
        scope: activeScope as 'local' | 'identity' | 'environment' | 'community',
        node_type: activeNodeType || undefined,
        layout: graphLayout,
        hours: graphLayout === 'timeline' ? timeRange : undefined,
        width: 1200,
        height: 600,
        limit: maxNodes,
        include_metrics: includeMetrics
      });
    },
    enabled: showVisualization,
  });

  // Search memory nodes
  const { data: searchResults, isLoading: searchLoading } = useQuery<GraphNode[]>({
    queryKey: ['memory-search', searchQuery, activeScope, activeNodeType],
    queryFn: async () => {
      const result = await cirisClient.memory.query(searchQuery, {
        limit: 1000,
        scope: activeScope,
        type: activeNodeType || undefined
      });
      return result;
    },
    enabled: searchQuery.length > 0,
  });

  // Get node counts by type and scope
  const { data: nodeStats } = useQuery({
    queryKey: ['memory-stats'],
    queryFn: async () => {
      // Simulate stats by querying for each type
      const stats: Partial<MemoryStats> = {
        nodes_by_type: {},
        nodes_by_scope: {},
        total_nodes: 0
      };

      // This is a simplified approach - ideally the API would provide these stats
      for (const nodeType of NODE_TYPES) {
        try {
          const nodes = await cirisClient.memory.query('', {
            type: nodeType,
            limit: 1
          });
          stats.nodes_by_type![nodeType] = nodes.length;
          stats.total_nodes! += nodes.length;
        } catch (e) {
          stats.nodes_by_type![nodeType] = 0;
        }
      }

      return stats as MemoryStats;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      setSearchQuery(query);
      setIsSearching(false);
    }, 300),
    []
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setIsSearching(true);
    debouncedSearch(query);
  };

  // Handle SVG click events for node selection
  useEffect(() => {
    if (svgContent && svgContainerRef.current) {
      const container = svgContainerRef.current;
      container.innerHTML = svgContent;

      // Create tooltip element
      const tooltip = document.createElement('div');
      tooltip.style.cssText = `
        position: absolute;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
        pointer-events: none;
        z-index: 1000;
        visibility: hidden;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(tooltip);

      // Add click handlers to all circles (nodes)
      const circles = container.querySelectorAll('circle');
      circles.forEach((circle, index) => {
        circle.style.cursor = 'pointer';
        const nodeId = circle.getAttribute('data-node-id');

        circle.addEventListener('click', async () => {
          if (nodeId) {
            // Clear existing search to force refresh
            setSearchQuery('');
            // Small delay to ensure state update
            setTimeout(() => {
              setSearchQuery(nodeId);
              toast.success(`Querying node: ${nodeId}`);
            }, 50);
          }
        });

        // Show tooltip on hover
        circle.addEventListener('mouseenter', (e) => {
          circle.setAttribute('opacity', '1.0');
          circle.style.filter = 'brightness(1.2)';

          if (nodeId) {
            tooltip.textContent = `Click to query: ${nodeId}`;
            tooltip.style.visibility = 'visible';

            const rect = (e.target as Element).getBoundingClientRect();
            tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
            tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5}px`;
          }
        });

        circle.addEventListener('mouseleave', () => {
          circle.setAttribute('opacity', '0.8');
          circle.style.filter = 'none';
          tooltip.style.visibility = 'hidden';
        });
      });

      // Cleanup tooltip on unmount
      return () => {
        if (tooltip.parentNode) {
          tooltip.parentNode.removeChild(tooltip);
        }
      };
    }
  }, [svgContent]);

  // Load selected node details
  const loadNodeDetails = async (nodeId: string) => {
    setIsLoadingNode(true);
    try {
      console.log('Loading node details for:', nodeId);
      // Use query endpoint with node_id for nodes with special characters
      const results = await cirisClient.memory.query(nodeId, { limit: 1 });
      console.log('Query results:', results);
      if (results && results.length > 0) {
        setSelectedNode(results[0]);
        toast.success('Node details loaded');
      } else {
        toast.error('Node not found');
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to load node details';
      toast.error(errorMessage);
      console.error('Error loading node:', error);
      console.error('Error details:', {
        nodeId,
        error: error?.response?.data || error
      });
    } finally {
      setIsLoadingNode(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getNodeTypeColor = (nodeType: string) => {
    const colors: Record<string, string> = {
      'concept': 'bg-orange-100 text-orange-800',
      'observation': 'bg-pink-100 text-pink-800',
      'identity': 'bg-indigo-100 text-indigo-800',
      'config': 'bg-amber-100 text-amber-800',
      'tsdb_data': 'bg-cyan-100 text-cyan-800',
      'audit_entry': 'bg-gray-100 text-gray-800',
    };
    return colors[nodeType.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h1 className="text-2xl font-bold text-gray-900">Memory Graph Explorer</h1>
          <p className="mt-2 text-gray-600">
            Visualize and explore the agent's memory graph with interactive node navigation
          </p>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {/* Scope Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
              <div className="flex flex-wrap gap-2">
                {SCOPES.map(scope => (
                  <button
                    key={scope.value}
                    onClick={() => {
                      setActiveScope(scope.value);
                      refetchViz();
                    }}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      activeScope === scope.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Node Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Node Type</label>
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={activeNodeType || ''}
                onChange={(e) => {
                  setActiveNodeType(e.target.value || null);
                  refetchViz();
                }}
              >
                <option value="">All Types</option>
                {NODE_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Layout Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Layout</label>
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={graphLayout}
                onChange={(e) => {
                  setGraphLayout(e.target.value as typeof graphLayout);
                  refetchViz();
                }}
              >
                {LAYOUTS.map(layout => (
                  <option key={layout} value={layout}>
                    {layout.charAt(0).toUpperCase() + layout.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Time Range (for timeline layout) */}
            {graphLayout === 'timeline' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Range</label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  value={timeRange}
                  onChange={(e) => {
                    setTimeRange(Number(e.target.value));
                    refetchViz();
                  }}
                >
                  <option value={6}>Last 6 hours</option>
                  <option value={24}>Last 24 hours</option>
                  <option value={48}>Last 2 days</option>
                  <option value={168}>Last week</option>
                </select>
              </div>
            )}

            {/* Max Nodes Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max Nodes</label>
              <select
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={maxNodes}
                onChange={(e) => {
                  setMaxNodes(Number(e.target.value));
                  refetchViz();
                }}
              >
                <option value={100}>100 nodes</option>
                <option value={250}>250 nodes</option>
                <option value={500}>500 nodes</option>
                <option value={750}>750 nodes</option>
                <option value={1000}>1000 nodes (max)</option>
              </select>
            </div>
          </div>

          {/* Include Metrics Checkbox */}
          <div className="mt-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                checked={includeMetrics}
                onChange={(e) => {
                  setIncludeMetrics(e.target.checked);
                  refetchViz();
                }}
              />
              <span className="text-sm text-gray-700">Include metric nodes</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Show metric_ TSDB_DATA nodes in the visualization (may be numerous)
            </p>
          </div>

          {/* Node Type Stats */}
          {nodeStats && nodeStats.nodes_by_type && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(nodeStats.nodes_by_type).map(([type, count]) => (
                <span
                  key={type}
                  className={`inline-flex items-center rounded-md px-3 py-1 text-xs font-medium ${getNodeTypeColor(type)}`}
                >
                  {type}: {count}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Graph Visualization */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              Memory Graph Visualization
              {graphLayout === 'timeline' && ` - Last ${timeRange} hours`}
            </h2>
            <button
              onClick={() => refetchViz()}
              disabled={vizLoading}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {vizLoading ? <SpinnerIcon className="mr-1" size="sm" /> : null}
              Refresh
            </button>
          </div>

          {vizLoading ? (
            <div className="flex justify-center items-center h-96">
              <SpinnerIcon size="lg" />
            </div>
          ) : (
            <div
              ref={svgContainerRef}
              className="w-full overflow-x-auto border border-gray-200 rounded-lg bg-gray-50"
              style={{ minHeight: '600px' }}
            />
          )}

          <p className="mt-2 text-sm text-gray-500">
            Click on any node in the graph to search for it and view its details
          </p>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Search Memory</h2>
          <div className="relative">
            <input
              type="text"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Search for thoughts, tasks, observations, or paste a node ID..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {(isSearching || searchLoading) && (
              <div className="absolute right-3 top-2">
                <SpinnerIcon className="text-gray-400" size="md" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Results */}
      {searchResults && searchResults.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Search Results ({searchResults.length})
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {searchResults.map((node) => (
                <div
                  key={node.id}
                  className="relative rounded-lg border border-gray-300 bg-white px-4 py-5 shadow-sm hover:border-gray-400 cursor-pointer transition-colors"
                  onClick={() => loadNodeDetails(node.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getNodeTypeColor(node.type)}`}>
                          {node.type}
                        </span>
                        <span className="text-xs text-gray-500">
                          {node.scope}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 line-clamp-3">
                        {node.attributes.content || node.attributes.description || node.attributes.name || node.id}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatDate(node.attributes.created_at || node.updated_at || '')}
                      </p>
                      <p className="mt-2 text-xs text-indigo-600">
                        Click to view full details →
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected Node Details */}
      {(selectedNode || isLoadingNode) && (
        <div className="bg-white shadow rounded-lg relative">
          {isLoadingNode && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-lg">
              <SpinnerIcon size="lg" />
            </div>
          )}
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Node Details</h3>
              <button
                onClick={() => {
                  setSelectedNode(null);
                  setIsLoadingNode(false);
                }}
                className="text-gray-400 hover:text-gray-500"
                disabled={isLoadingNode}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedNode && (
              <div className="space-y-4">
                {/* Node Info */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700">Node Information</h4>
                  <dl className="mt-2 border-t border-gray-200 divide-y divide-gray-200">
                    <div className="py-3 flex justify-between text-sm">
                      <dt className="text-gray-500">ID</dt>
                      <dd className="text-gray-900 font-mono text-xs">{selectedNode.id}</dd>
                  </div>
                  <div className="py-3 flex justify-between text-sm">
                    <dt className="text-gray-500">Type</dt>
                    <dd className="text-gray-900">
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${getNodeTypeColor(selectedNode.type)}`}>
                        {selectedNode.type}
                      </span>
                    </dd>
                  </div>
                  <div className="py-3 flex justify-between text-sm">
                    <dt className="text-gray-500">Scope</dt>
                    <dd className="text-gray-900">{selectedNode.scope}</dd>
                  </div>
                  <div className="py-3 flex justify-between text-sm">
                    <dt className="text-gray-500">Created</dt>
                    <dd className="text-gray-900">{selectedNode.attributes?.created_at ? formatDate(selectedNode.attributes.created_at) : 'N/A'}</dd>
                  </div>
                  <div className="py-3 flex justify-between text-sm">
                    <dt className="text-gray-500">Updated</dt>
                    <dd className="text-gray-900">{selectedNode.updated_at ? formatDate(selectedNode.updated_at) : 'N/A'}</dd>
                  </div>
                </dl>
              </div>

              {/* Node Properties */}
              <div>
                <h4 className="text-sm font-medium text-gray-700">Properties</h4>
                <div className="mt-2 bg-gray-50 rounded-lg p-4">
                  <pre className="text-xs text-gray-900 whitespace-pre-wrap">
                    {JSON.stringify(selectedNode.attributes, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {searchQuery && searchResults && searchResults.length === 0 && !searchLoading && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No results found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try searching with different keywords or check the filters
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
