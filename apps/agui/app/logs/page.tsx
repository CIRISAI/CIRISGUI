'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cirisClient } from '../../lib/ciris-sdk';
import { useAuth } from '../../contexts/AuthContext';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

// Log level configuration
const LOG_LEVELS = {
  ERROR: { color: '#ef4444', bgColor: '#fee2e2', label: 'ERROR' },
  WARN: { color: '#f59e0b', bgColor: '#fef3c7', label: 'WARN' },
  INFO: { color: '#3b82f6', bgColor: '#dbeafe', label: 'INFO' },
  DEBUG: { color: '#6b7280', bgColor: '#f3f4f6', label: 'DEBUG' },
};

const LOG_LEVEL_OPTIONS = ['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'];

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  message: string;
  metadata?: any;
}

interface Incident {
  id: string;
  timestamp: string;
  severity: string;
  service: string;
  message: string;
  details?: any;
  resolved?: boolean;
}

export default function LogsPage() {
  const { user } = useAuth();
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [selectedService, setSelectedService] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [showIncidents, setShowIncidents] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(5000);
  const [limit, setLimit] = useState<number>(100);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch logs with polling
  const { data: logsData, refetch: refetchLogs } = useQuery({
    queryKey: ['logs', selectedLevel, selectedService, limit],
    queryFn: () => cirisClient.telemetry.getLogs(
      selectedLevel === 'ALL' ? undefined : selectedLevel,
      selectedService === 'ALL' ? undefined : selectedService,
      limit
    ),
    refetchInterval: refreshInterval,
    refetchIntervalInBackground: false,
  });

  // Fetch incidents
  const { data: incidentsData, refetch: refetchIncidents } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => cirisClient.telemetry.getIncidents({ limit: 50 }),
    refetchInterval: refreshInterval * 2, // Refresh less frequently
    enabled: showIncidents,
  });

  // Extract unique services from logs
  const services = React.useMemo(() => {
    if (!logsData) return ['ALL'];
    const uniqueServices = new Set<string>(['ALL']);
    logsData.forEach((log: any) => {
      if (log.service) uniqueServices.add(log.service);
    });
    return Array.from(uniqueServices).sort();
  }, [logsData]);

  // Filter logs based on criteria
  const filteredLogs = React.useMemo(() => {
    if (!logsData) return [];

    return logsData.filter((log: any) => {
      // Level filter
      if (selectedLevel !== 'ALL' && log.level !== selectedLevel) return false;

      // Service filter
      if (selectedService !== 'ALL' && log.service !== selectedService) return false;

      // Search filter
      if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;

      return true;
    });
  }, [logsData, selectedLevel, selectedService, searchQuery]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs, autoScroll]);

  // Toggle log expansion
  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // Copy log to clipboard
  const copyToClipboard = (log: any) => {
    const text = `[${log.timestamp}] [${log.level}] [${log.service}] ${log.message}${
      log.metadata ? '\nMetadata: ' + JSON.stringify(log.metadata, null, 2) : ''
    }`;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  // Export logs
  const exportLogs = () => {
    const data = filteredLogs.map((log: any) => ({
      timestamp: log.timestamp,
      level: log.level,
      service: log.service,
      message: log.message,
      metadata: log.metadata,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciris-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs exported');
  };

  // Manual refresh
  const handleRefresh = () => {
    refetchLogs();
    if (showIncidents) refetchIncidents();
    toast.success('Logs refreshed');
  };

  // Check if user is scrolled to bottom
  const handleScroll = () => {
    if (!logsContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;

    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    } else if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  };

  return (
    <ProtectedRoute>
      <div style={{ height: 'calc(100vh - 2rem)', display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ margin: '0 0 1rem 0' }}>System Logs</h1>

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        padding: '1rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <div>
          <label style={{ marginRight: '0.5rem' }}>Level:</label>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            {LOG_LEVEL_OPTIONS.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ marginRight: '0.5rem' }}>Service:</label>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            {services.map(service => (
              <option key={service} value={service}>{service}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ marginRight: '0.5rem' }}>Limit:</label>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              border: '1px solid #ddd'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              style={{ marginRight: '0.25rem' }}
            />
            Auto-scroll
          </label>

          <label>
            <input
              type="checkbox"
              checked={showIncidents}
              onChange={(e) => setShowIncidents(e.target.checked)}
              style={{ marginRight: '0.25rem' }}
            />
            Show Incidents
          </label>

          <button
            onClick={handleRefresh}
            style={{
              padding: '0.25rem 1rem',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#3b82f6',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>

          <button
            onClick={exportLogs}
            style={{
              padding: '0.25rem 1rem',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#10b981',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Export
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', gap: '1rem', minHeight: 0 }}>
        {/* Logs panel */}
        <div style={{ flex: showIncidents ? 2 : 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px 8px 0 0',
            fontWeight: 'bold'
          }}>
            Logs ({filteredLogs.length} entries)
          </div>

          <div
            ref={logsContainerRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              backgroundColor: '#1a1a1a',
              color: '#e5e5e5',
              padding: '1rem',
              overflowY: 'auto',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '13px',
              lineHeight: '1.5',
              borderRadius: '0 0 8px 8px'
            }}
          >
            {filteredLogs.length === 0 ? (
              <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
                No logs matching current filters
              </div>
            ) : (
              filteredLogs.map((log: any) => {
                const logConfig = LOG_LEVELS[log.level as keyof typeof LOG_LEVELS] || LOG_LEVELS.INFO;
                const isExpanded = expandedLogs.has(log.id);
                const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

                return (
                  <div
                    key={log.id}
                    style={{
                      marginBottom: '0.5rem',
                      padding: '0.5rem',
                      backgroundColor: '#2a2a2a',
                      borderRadius: '4px',
                      borderLeft: `4px solid ${logConfig.color}`,
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', width: '100%' }}>
                      <span style={{
                        color: '#888',
                        fontSize: '11px',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}>
                        {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                      </span>

                      <span style={{
                        color: logConfig.color,
                        fontWeight: 'bold',
                        fontSize: '11px',
                        minWidth: '50px',
                        flexShrink: 0
                      }}>
                        [{log.level}]
                      </span>

                      <span style={{
                        color: '#66d9ef',
                        fontSize: '11px',
                        minWidth: '100px',
                        flexShrink: 0
                      }}>
                        [{log.service}]
                      </span>

                      <span style={{
                        flex: 1,
                        wordBreak: 'break-word',
                        cursor: hasMetadata ? 'pointer' : 'default',
                        minWidth: 0,
                        overflow: 'hidden'
                      }}
                      onClick={() => hasMetadata && toggleLogExpansion(log.id)}
                      >
                        {log.message}
                      </span>

                      <button
                        onClick={() => copyToClipboard(log)}
                        style={{
                          padding: '2px 6px',
                          fontSize: '11px',
                          backgroundColor: '#444',
                          color: '#aaa',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                    </div>

                    {hasMetadata && isExpanded && (
                      <div style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem',
                        backgroundColor: '#1a1a1a',
                        borderRadius: '4px',
                        fontSize: '12px',
                        color: '#999'
                      }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Incidents panel */}
        {showIncidents && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '400px' }}>
            <div style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#fee2e2',
              borderRadius: '8px 8px 0 0',
              fontWeight: 'bold',
              color: '#991b1b'
            }}>
              Incidents ({incidentsData?.length || 0})
            </div>

            <div style={{
              flex: 1,
              backgroundColor: '#fef2f2',
              padding: '1rem',
              overflowY: 'auto',
              borderRadius: '0 0 8px 8px'
            }}>
              {!incidentsData || incidentsData.length === 0 ? (
                <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
                  No recent incidents
                </div>
              ) : (
                incidentsData.map((incident: any) => (
                  <div
                    key={incident.id}
                    style={{
                      marginBottom: '0.75rem',
                      padding: '0.75rem',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                      fontSize: '14px'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem'
                    }}>
                      <span style={{
                        fontWeight: 'bold',
                        color: incident.severity === 'CRITICAL' ? '#dc2626' : '#f59e0b'
                      }}>
                        {incident.severity}
                      </span>
                      <span style={{ fontSize: '12px', color: '#666' }}>
                        {format(new Date(incident.timestamp), 'HH:mm:ss')}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#4b5563', marginBottom: '0.25rem' }}>
                      {incident.service}
                    </div>

                    <div style={{ color: '#1f2937' }}>
                      {incident.message}
                    </div>

                    {incident.resolved && (
                      <div style={{
                        marginTop: '0.5rem',
                        fontSize: '12px',
                        color: '#10b981'
                      }}>
                        ✓ Resolved
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      <div style={{
        marginTop: '0.5rem',
        fontSize: '12px',
        color: '#666',
        textAlign: 'right'
      }}>
        {refreshInterval > 0 ? `Auto-refreshing every ${refreshInterval/1000}s` : 'Auto-refresh disabled'}
      </div>
    </div>
    </ProtectedRoute>
  );
}
