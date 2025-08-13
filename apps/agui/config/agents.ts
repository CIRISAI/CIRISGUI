// Agent configuration for agents.ciris.ai
export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  apiUrl: string;
  port: number;
  status?: 'online' | 'offline' | 'maintenance';
}

export const AGENTS: AgentConfig[] = [
  {
    id: 'datum',
    name: 'Datum',
    description: 'A humble data point that provides singular, focused observations',
    apiUrl: process.env.NEXT_PUBLIC_DATUM_URL || 'https://agents.ciris.ai/api/datum',
    port: 8080,
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Asks wise questions to foster understanding and growth',
    apiUrl: process.env.NEXT_PUBLIC_SAGE_URL || 'https://agents.ciris.ai/api/sage',
    port: 8081,
  },
  {
    id: 'scout',
    name: 'Scout',
    description: 'Explores direct paths and demonstrates principles through clear action',
    apiUrl: process.env.NEXT_PUBLIC_SCOUT_URL || 'https://agents.ciris.ai/api/scout',
    port: 8082,
  },
  {
    id: 'echo-core',
    name: 'Echo-Core',
    description: 'General Discord moderation agent that operates with a light touch',
    apiUrl: process.env.NEXT_PUBLIC_ECHO_CORE_URL || 'https://agents.ciris.ai/api/echo-core',
    port: 8083,
  },
  {
    id: 'echo-speculative',
    name: 'Echo-Speculative',
    description: 'Discord moderation agent designed for speculative discussion channels',
    apiUrl: process.env.NEXT_PUBLIC_ECHO_SPEC_URL || 'https://agents.ciris.ai/api/echo-speculative',
    port: 8084,
  },
];

// For local development
if (process.env.NODE_ENV === 'development') {
  AGENTS.forEach((agent, index) => {
    agent.apiUrl = `http://localhost:${8080 + index}`;
  });
}
