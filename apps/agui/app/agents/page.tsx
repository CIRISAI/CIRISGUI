'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useAgent } from '@/contexts/AgentContextHybrid';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusDot } from '@/components/Icons';

export default function AgentsPage() {
  const { user } = useAuth();
  const { agents, currentAgent } = useAgent();

  return (
    <ProtectedRoute>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">Agents</h1>

        <div className="grid gap-4">
          {agents.map((agent) => (
            <Card key={agent.agent_id} className={currentAgent?.agent_id === agent.agent_id ? 'border-primary' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{agent.agent_name}</CardTitle>
                  <StatusDot status={agent.health === 'healthy' ? 'green' : 'yellow'} />
                </div>
                <CardDescription>
                  Agent ID: {agent.agent_id} | Status: {agent.status}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  API URL: {agent.api_endpoint || `${agent.api_url || 'localhost'}:${agent.api_port || 8080}`}
                </p>
                {currentAgent?.agent_id === agent.agent_id && (
                  <p className="text-sm text-primary mt-2">Currently selected</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {agents.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">No agents configured</p>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}
