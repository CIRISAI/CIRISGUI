"use client";

import React, { useState, useEffect } from "react";
import { cirisClient } from "../../lib/ciris-sdk";

export default function ServicesManagementPage() {
  const [services, setServices] = useState<any>(null);
  const [serviceHealth, setServiceHealth] = useState<any>(null);
  const [selectionExplanation, setSelectionExplanation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Service filtering state
  const [filterHandler, setFilterHandler] = useState('');
  const [filterServiceType, setFilterServiceType] = useState('');

  // Priority update state
  const [selectedProvider, setSelectedProvider] = useState('');
  const [newPriority, setNewPriority] = useState('NORMAL');
  const [newPriorityGroup, setNewPriorityGroup] = useState<number>(0);
  const [newStrategy, setNewStrategy] = useState('FALLBACK');
  const [priorityUpdateResult, setPriorityUpdateResult] = useState<any>(null);

  // Circuit breaker reset state
  const [resetServiceType, setResetServiceType] = useState('');
  const [resetResult, setResetResult] = useState<any>(null);

  // Diagnostic state
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const fetchData = async () => {
    try {
      setError(null);
      const [servicesResp, healthResp, explanationResp] = await Promise.all([
        cirisClient.system.getServices().catch(e => ({ error: e.message })),
        // TODO: These endpoints don't exist in SDK yet
        Promise.resolve({ overall_health: 'unknown', total_services: 0, healthy_services: 0, unhealthy_services: 0 }),
        Promise.resolve({ service_selection_logic: null })
      ]);

      setServices(servicesResp);
      setServiceHealth(healthResp);
      setSelectionExplanation(explanationResp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [filterHandler, filterServiceType]);

  const refresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleUpdatePriority = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProvider) return;

    try {
      // TODO: updateServicePriority endpoint not in SDK yet
      const result = { status: 'error', message: 'updateServicePriority not implemented in SDK' };
      setPriorityUpdateResult(result);
      await refresh();
    } catch (error) {
      setPriorityUpdateResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleResetCircuitBreakers = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // TODO: resetCircuitBreakers endpoint not in SDK yet
      const result = { status: 'error', message: 'resetCircuitBreakers not implemented in SDK' };
      setResetResult(result);
      await refresh();
    } catch (error) {
      setResetResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleDiagnoseIssues = async () => {
    try {
      // TODO: diagnoseServiceIssues endpoint not in SDK yet
      const result = { error: 'diagnoseServiceIssues not implemented in SDK' };
      setDiagnostics(result);
    } catch (error) {
      setDiagnostics({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  if (loading) {
    return <div><h1>Service Management</h1><p>Loading service information...</p></div>;
  }

  // Extract all providers for priority update dropdown
  const allProviders: Array<{name: string, scope: string, service_type: string}> = [];

  if (services && !services.error) {
    // Handler-specific services
    for (const [handler, serviceTypes] of Object.entries(services.handlers || {})) {
      for (const [serviceType, providers] of Object.entries(serviceTypes as any)) {
        for (const provider of providers as any[]) {
          allProviders.push({
            name: provider.name,
            scope: `handler:${handler}`,
            service_type: serviceType
          });
        }
      }
    }

    // Global services
    for (const [serviceType, providers] of Object.entries(services.global_services || {})) {
      for (const provider of providers as any[]) {
        allProviders.push({
          name: provider.name,
          scope: 'global',
          service_type: serviceType
        });
      }
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1>Service Management</h1>
        <div>
          <button onClick={refresh} disabled={refreshing} style={{ marginRight: 10 }}>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button onClick={handleDiagnoseIssues}>
            Diagnose Issues
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 10, background: '#ffebee', border: '1px solid #f44336', borderRadius: 4, marginBottom: 20 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Service Filters */}
      <section style={{ marginBottom: 30, padding: 15, border: '1px solid #ddd', borderRadius: 5 }}>
        <h2>Service Filters</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15 }}>
          <div>
            <label>Handler Filter:</label>
            <input
              type="text"
              value={filterHandler}
              onChange={e => setFilterHandler(e.target.value)}
              placeholder="Filter by handler name"
              style={{ width: '100%', marginTop: 5 }}
            />
          </div>
          <div>
            <label>Service Type Filter:</label>
            <select
              value={filterServiceType}
              onChange={e => setFilterServiceType(e.target.value)}
              style={{ width: '100%', marginTop: 5 }}
            >
              <option value="">All Service Types</option>
              <option value="llm">LLM</option>
              <option value="communication">Communication</option>
              <option value="memory">Memory</option>
              <option value="audit">Audit</option>
              <option value="tool">Tool</option>
              <option value="wise_authority">Wise Authority</option>
            </select>
          </div>
        </div>
      </section>

      {/* Service Health Overview */}
      <section style={{ marginBottom: 30, padding: 15, border: '1px solid #ddd', borderRadius: 5 }}>
        <h2>Service Health Overview</h2>
        {serviceHealth && !serviceHealth.error ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15 }}>
            <div style={{ padding: 10, background: '#f8f8f8', borderRadius: 4 }}>
              <strong>Overall Health:</strong>
              <div style={{
                color: serviceHealth.overall_health === 'healthy' ? 'green' :
                       serviceHealth.overall_health === 'degraded' ? 'orange' : 'red',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                {serviceHealth.overall_health}
              </div>
            </div>
            <div style={{ padding: 10, background: '#f8f8f8', borderRadius: 4 }}>
              <strong>Total Services:</strong>
              <div>{serviceHealth.total_services}</div>
            </div>
            <div style={{ padding: 10, background: '#f8f8f8', borderRadius: 4 }}>
              <strong>Healthy Services:</strong>
              <div style={{ color: 'green' }}>{serviceHealth.healthy_services}</div>
            </div>
            <div style={{ padding: 10, background: '#f8f8f8', borderRadius: 4 }}>
              <strong>Unhealthy Services:</strong>
              <div style={{ color: serviceHealth.unhealthy_services > 0 ? 'red' : 'green' }}>
                {serviceHealth.unhealthy_services}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 10, background: '#ffebee', borderRadius: 4 }}>
            Service health information unavailable: {serviceHealth?.error || 'Unknown error'}
          </div>
        )}
      </section>

      {/* Priority Management */}
      <section style={{ marginBottom: 30, padding: 15, border: '1px solid #ddd', borderRadius: 5 }}>
        <h2>Service Priority Management</h2>
        <form onSubmit={handleUpdatePriority} style={{ marginBottom: 15 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 15 }}>
            <div>
              <label>Service Provider:</label>
              <select
                value={selectedProvider}
                onChange={e => setSelectedProvider(e.target.value)}
                required
                style={{ width: '100%', marginTop: 5 }}
              >
                <option value="">Select a service provider</option>
                {allProviders.map(provider => (
                  <option key={provider.name} value={provider.name}>
                    {provider.name} ({provider.scope} - {provider.service_type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Priority Level:</label>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value)}
                style={{ width: '100%', marginTop: 5 }}
              >
                <option value="CRITICAL">CRITICAL (0)</option>
                <option value="HIGH">HIGH (1)</option>
                <option value="NORMAL">NORMAL (2)</option>
                <option value="LOW">LOW (3)</option>
                <option value="FALLBACK">FALLBACK (9)</option>
              </select>
            </div>
            <div>
              <label>Priority Group:</label>
              <input
                type="number"
                min="0"
                max="10"
                value={newPriorityGroup}
                onChange={e => setNewPriorityGroup(parseInt(e.target.value))}
                style={{ width: '100%', marginTop: 5 }}
              />
            </div>
            <div>
              <label>Selection Strategy:</label>
              <select
                value={newStrategy}
                onChange={e => setNewStrategy(e.target.value)}
                style={{ width: '100%', marginTop: 5 }}
              >
                <option value="FALLBACK">FALLBACK (First available)</option>
                <option value="ROUND_ROBIN">ROUND_ROBIN (Load balance)</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={!selectedProvider}>Update Service Priority</button>
        </form>

        {priorityUpdateResult && (
          <div style={{ padding: 10, background: '#f0f0f0', borderRadius: 4, fontSize: 12, marginTop: 10 }}>
            <strong>Priority Update Result:</strong>
            <pre>{JSON.stringify(priorityUpdateResult, null, 2)}</pre>
          </div>
        )}
      </section>

      {/* Circuit Breaker Management */}
      <section style={{ marginBottom: 30, padding: 15, border: '1px solid #ddd', borderRadius: 5 }}>
        <h2>Circuit Breaker Management</h2>
        <form onSubmit={handleResetCircuitBreakers} style={{ marginBottom: 15 }}>
          <div style={{ marginBottom: 10 }}>
            <label>Service Type (optional):</label>
            <select
              value={resetServiceType}
              onChange={e => setResetServiceType(e.target.value)}
              style={{ width: 300, marginTop: 5, marginLeft: 10 }}
            >
              <option value="">All Service Types</option>
              <option value="llm">LLM</option>
              <option value="communication">Communication</option>
              <option value="memory">Memory</option>
              <option value="audit">Audit</option>
              <option value="tool">Tool</option>
              <option value="wise_authority">Wise Authority</option>
            </select>
          </div>
          <button type="submit">Reset Circuit Breakers</button>
        </form>

        {resetResult && (
          <div style={{ padding: 10, background: '#f0f0f0', borderRadius: 4, fontSize: 12 }}>
            <strong>Reset Result:</strong>
            <pre>{JSON.stringify(resetResult, null, 2)}</pre>
          </div>
        )}
      </section>

      {/* Service Selection Logic Explanation */}
      {selectionExplanation && !selectionExplanation.error && (
        <section style={{ marginBottom: 30, padding: 15, border: '1px solid #ddd', borderRadius: 5 }}>
          <h2>Service Selection Logic</h2>
          <div style={{ marginBottom: 15 }}>
            <h3>Overview</h3>
            <p>{selectionExplanation.service_selection_logic.overview}</p>
          </div>

          <div style={{ marginBottom: 15 }}>
            <h3>Priority Groups</h3>
            <p><strong>Description:</strong> {selectionExplanation.service_selection_logic.priority_groups.description}</p>
            <p><strong>Behavior:</strong> {selectionExplanation.service_selection_logic.priority_groups.behavior}</p>
          </div>

          <div style={{ marginBottom: 15 }}>
            <h3>Priority Levels</h3>
            <p>{selectionExplanation.service_selection_logic.priority_levels.description}</p>
            <div style={{ marginLeft: 20 }}>
              {Object.entries(selectionExplanation.service_selection_logic.priority_levels.levels).map(([level, info]: [string, any]) => (
                <div key={level} style={{ marginBottom: 5 }}>
                  <strong>{level} ({info.value}):</strong> {info.description}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 15 }}>
            <h3>Selection Strategies</h3>
            {Object.entries(selectionExplanation.service_selection_logic.selection_strategies).map(([strategy, info]: [string, any]) => (
              <div key={strategy} style={{ marginBottom: 10 }}>
                <strong>{strategy}:</strong> {info.description}
                <br />
                <em>Behavior:</em> {info.behavior}
              </div>
            ))}
          </div>

          <div style={{ marginBottom: 15 }}>
            <h3>Selection Flow</h3>
            <ol>
              {selectionExplanation.service_selection_logic.selection_flow.map((step: string, index: number) => (
                <li key={index} style={{ marginBottom: 5 }}>{step}</li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* Diagnostic Results */}
      {diagnostics && (
        <section style={{ marginBottom: 30, padding: 15, border: '1px solid #ddd', borderRadius: 5 }}>
          <h2>Service Diagnostics</h2>
          {!diagnostics.error ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 15, marginBottom: 15 }}>
                <div style={{ padding: 10, background: '#f8f8f8', borderRadius: 4 }}>
                  <strong>Overall Health:</strong>
                  <div style={{
                    color: diagnostics.overall_health === 'healthy' ? 'green' :
                           diagnostics.overall_health === 'degraded' ? 'orange' : 'red',
                    fontWeight: 'bold'
                  }}>
                    {diagnostics.overall_health}
                  </div>
                </div>
                <div style={{ padding: 10, background: '#f8f8f8', borderRadius: 4 }}>
                  <strong>Issues Found:</strong>
                  <div style={{ color: diagnostics.issues_found > 0 ? 'red' : 'green' }}>
                    {diagnostics.issues_found}
                  </div>
                </div>
                <div style={{ padding: 10, background: '#f8f8f8', borderRadius: 4 }}>
                  <strong>Global Services:</strong>
                  <div>{diagnostics.service_summary.global_services}</div>
                </div>
                <div style={{ padding: 10, background: '#f8f8f8', borderRadius: 4 }}>
                  <strong>Handler Services:</strong>
                  <div>{diagnostics.service_summary.handler_specific_services}</div>
                </div>
              </div>

              {diagnostics.issues.length > 0 && (
                <div style={{ marginBottom: 15 }}>
                  <h3>Issues:</h3>
                  <ul>
                    {diagnostics.issues.map((issue: string, index: number) => (
                      <li key={index} style={{ color: 'red' }}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              {diagnostics.recommendations.length > 0 && (
                <div>
                  <h3>Recommendations:</h3>
                  <ul>
                    {diagnostics.recommendations.map((rec: string, index: number) => (
                      <li key={index} style={{ color: 'blue' }}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 10, background: '#ffebee', borderRadius: 4 }}>
              Diagnostics failed: {diagnostics.error}
            </div>
          )}
        </section>
      )}

      {/* Registered Services Details */}
      <section style={{ marginBottom: 30, padding: 15, border: '1px solid #ddd', borderRadius: 5 }}>
        <h2>Registered Services</h2>
        {services && !services.error ? (
          <div>
            {/* Handler-specific services */}
            {Object.keys(services.handlers || {}).length > 0 && (
              <div style={{ marginBottom: 25 }}>
                <h3>Handler-Specific Services</h3>
                {Object.entries(services.handlers || {}).map(([handler, serviceTypes]: [string, any]) => (
                  <div key={handler} style={{ marginBottom: 20, padding: 10, background: '#f9f9f9', borderRadius: 4 }}>
                    <h4>Handler: {handler}</h4>
                    {Object.entries(serviceTypes).map(([serviceType, providers]: [string, any]) => (
                      <div key={serviceType} style={{ marginBottom: 15 }}>
                        <strong>{serviceType} Services:</strong>
                        <div style={{ overflowX: 'auto', marginTop: 5 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: '#e0e0e0' }}>
                                <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Name</th>
                                <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Priority</th>
                                <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Group</th>
                                <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Strategy</th>
                                <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Circuit Breaker</th>
                                <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Capabilities</th>
                              </tr>
                            </thead>
                            <tbody>
                              {providers.map((provider: any, index: number) => (
                                <tr key={index}>
                                  <td style={{ border: '1px solid #ddd', padding: 4 }}>{provider.name}</td>
                                  <td style={{ border: '1px solid #ddd', padding: 4 }}>{provider.priority}</td>
                                  <td style={{ border: '1px solid #ddd', padding: 4 }}>{provider.priority_group}</td>
                                  <td style={{ border: '1px solid #ddd', padding: 4 }}>{provider.strategy}</td>
                                  <td style={{ border: '1px solid #ddd', padding: 4 }}>
                                    <span style={{
                                      color: provider.circuit_breaker_state === 'closed' ? 'green' : 'red',
                                      fontWeight: 'bold'
                                    }}>
                                      {provider.circuit_breaker_state || 'unknown'}
                                    </span>
                                  </td>
                                  <td style={{ border: '1px solid #ddd', padding: 4 }}>
                                    {provider.capabilities?.join(', ') || 'None'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Global services */}
            {Object.keys(services.global_services || {}).length > 0 && (
              <div>
                <h3>Global Services</h3>
                {Object.entries(services.global_services || {}).map(([serviceType, providers]: [string, any]) => (
                  <div key={serviceType} style={{ marginBottom: 15, padding: 10, background: '#f9f9f9', borderRadius: 4 }}>
                    <strong>{serviceType} Services:</strong>
                    <div style={{ overflowX: 'auto', marginTop: 5 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#e0e0e0' }}>
                            <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Name</th>
                            <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Priority</th>
                            <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Group</th>
                            <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Strategy</th>
                            <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Circuit Breaker</th>
                            <th style={{ border: '1px solid #ddd', padding: 4, textAlign: 'left' }}>Capabilities</th>
                          </tr>
                        </thead>
                        <tbody>
                          {providers.map((provider: any, index: number) => (
                            <tr key={index}>
                              <td style={{ border: '1px solid #ddd', padding: 4 }}>{provider.name}</td>
                              <td style={{ border: '1px solid #ddd', padding: 4 }}>{provider.priority}</td>
                              <td style={{ border: '1px solid #ddd', padding: 4 }}>{provider.priority_group}</td>
                              <td style={{ border: '1px solid #ddd', padding: 4 }}>{provider.strategy}</td>
                              <td style={{ border: '1px solid #ddd', padding: 4 }}>
                                <span style={{
                                  color: provider.circuit_breaker_state === 'closed' ? 'green' : 'red',
                                  fontWeight: 'bold'
                                }}>
                                  {provider.circuit_breaker_state || 'unknown'}
                                </span>
                              </td>
                              <td style={{ border: '1px solid #ddd', padding: 4 }}>
                                {provider.capabilities?.join(', ') || 'None'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: 10, background: '#fff3cd', borderRadius: 4 }}>
            Services information unavailable: {services?.error || 'Unknown error'}
          </div>
        )}
      </section>
    </div>
  );
}
