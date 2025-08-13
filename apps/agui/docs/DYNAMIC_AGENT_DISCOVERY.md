# Dynamic Agent Discovery Integration Guide

## Overview

The CIRIS GUI now supports dynamic agent discovery through CIRISManager, replacing the hardcoded agent configuration.

## Implementation Complete

### 1. TypeScript SDK Updates ✅
- Added `ManagerResource` class to SDK
- Endpoints implemented:
  - `GET /manager/v1/agents` - List all agents
  - `GET /manager/v1/agents/{id}` - Get agent details
  - `POST /manager/v1/agents/{id}/notify-update` - Send update notifications
  - `GET /manager/v1/deployments/{id}/status` - Check deployment status
  - `GET /manager/v1/health` - CIRISManager health

### 2. React Hook ✅
- Created `useAgentDiscovery` hook for easy integration
- Features:
  - Auto-refresh every 30 seconds
  - Error handling with fallback
  - Computed properties (running agents, agents with updates)
  - Actions for fetching, selecting, and notifying

### 3. Components ✅
- `AgentSelector` - Dropdown/list component for agent selection
- Shows agent status, health, and update availability
- Visual indicators for different states

### 4. Example Implementation ✅
- Created `/agents` page demonstrating full functionality
- Shows how to integrate agent discovery with existing pages

## Integration Steps

### Step 1: Replace Static Agent Config

**Old way (hardcoded):**
```typescript
import { AGENTS } from '../config/agents';
const agent = AGENTS[0];
```

**New way (dynamic):**
```typescript
import { useAgentDiscovery } from '@/hooks/useAgentDiscovery';

function MyComponent() {
  const { agents, selectedAgent, selectAgent } = useAgentDiscovery();
  // Use agents...
}
```

### Step 2: Update AgentContext

Replace the current `AgentContext.tsx` with `AgentContextDynamic.tsx`:

```bash
mv contexts/AgentContext.tsx contexts/AgentContext.old.tsx
mv contexts/AgentContextDynamic.tsx contexts/AgentContext.tsx
```

### Step 3: Update Layout/Navigation

Add the AgentSelector to your main layout:

```typescript
import { AgentSelector } from '@/components/agent-selector';

function Layout() {
  const handleAgentSelect = (agentId: string, apiEndpoint?: string) => {
    // Update SDK base URL
    cirisClient.setConfig({ baseURL: apiEndpoint });
  };

  return (
    <div>
      <AgentSelector onAgentSelect={handleAgentSelect} />
      {/* Rest of layout */}
    </div>
  );
}
```

### Step 4: Handle Missing CIRISManager

The hook includes fallback behavior when CIRISManager is not available:

```typescript
// In useAgentDiscovery hook
if (error) {
  // Falls back to default agent configuration
  const defaultAgent = {
    agent_id: 'datum',
    agent_name: 'Datum',
    api_endpoint: window.location.origin,
    // ...
  };
}
```

## Testing

1. **With CIRISManager Running:**
   - Agents are discovered automatically
   - Status updates every 30 seconds
   - Update notifications work

2. **Without CIRISManager:**
   - Falls back to default agent
   - Shows connection error
   - Basic functionality still works

## Environment Variables

Make sure to set the CIRISManager endpoint if it's not on the same host:

```env
NEXT_PUBLIC_CIRIS_MANAGER_URL=http://localhost:8888
```

## Next Steps

1. Test the integration in development
2. Update all pages to use dynamic discovery
3. Remove hardcoded agent configurations
4. Add agent health monitoring dashboard
5. Implement agent creation UI (requires WA signatures)
