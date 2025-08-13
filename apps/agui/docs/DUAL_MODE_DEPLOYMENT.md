# Dual-Mode Deployment for CIRIS GUI

The CIRIS GUI supports two deployment modes to enable both standalone single-agent deployments and multi-agent orchestration via CIRISManager.

## Overview

### Mode 1: Standalone Agent (Default)
- GUI runs at `/` (root)
- Talks directly to `/v1/*` API endpoints
- Single agent deployment
- No CIRISManager required

### Mode 2: Managed Agent
- GUI accessed at `/agent/{agent_id}`
- Talks to `/api/{agent_id}/v1/*` endpoints
- Multi-agent support via CIRISManager
- CIRISManager handles routing

## Implementation Details

### Mode Detection

The GUI automatically detects its deployment mode based on the URL path:

```typescript
function detectDeploymentMode(): DeploymentMode {
  const path = window.location.pathname;
  const isManaged = path.startsWith('/agent/');

  if (isManaged) {
    // Managed mode: extract agent ID from /agent/{agent_id}
    const pathParts = path.split('/');
    const agentId = pathParts[2] || 'default';
    const apiBase = `/api/${agentId}/v1`;
    return { mode: 'managed', agentId, apiBase };
  } else {
    // Standalone mode: direct API access
    return { mode: 'standalone', agentId: 'default', apiBase: '/v1' };
  }
}
```

### API Path Handling

The `api-utils.ts` module provides utilities for handling API paths in both modes:

```typescript
// Get the base URL for API calls
const baseURL = getApiBaseUrl(agentId);

// Get a full API URL for a specific endpoint
const url = getApiUrl('v1/agent/status', agentId);
```

### Agent Context

The `AgentContextDynamic.tsx` context provider handles both modes:

1. **Standalone Mode**:
   - Creates a single default agent
   - No agent discovery needed
   - Direct API access at `/v1/*`

2. **Managed Mode**:
   - Discovers agents from CIRISManager
   - Supports agent switching
   - Routes through `/api/{agent_id}/v1/*`

## Deployment Scenarios

### Standalone Deployment

```yaml
services:
  agent:
    image: ciris-agent
    ports:
      - "8080:8080"
    environment:
      - CIRIS_ADAPTER=api

  gui:
    image: ciris-gui
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_CIRIS_API_URL=http://agent:8080
```

Access: `http://localhost:3000`

### Managed Deployment

When CIRISManager is added:

1. Manager's nginx takes over routing
2. Redirects `/` to manager GUI
3. Serves agent GUI at `/agent/{agent_id}`
4. Routes `/api/{agent_id}/v1/*` to agent's `/v1/*`

No changes needed to the agent container!

## Key Benefits

1. **No Breaking Changes**: Existing standalone deployments continue working
2. **Manager Compatible**: Same GUI works in both modes
3. **No Manager Dependencies**: GUI never calls `/manager/v1/*` endpoints directly
4. **Auto-Detection**: GUI automatically adapts based on URL

## OAuth Integration

OAuth callbacks work in both modes:

- **Standalone**: `/oauth/{agent_id}/callback`
- **Managed**: Same path, but routing handled by CIRISManager

The OAuth flow automatically detects the mode and redirects appropriately:

```typescript
const { mode } = detectDeploymentMode();
if (mode === 'managed') {
  router.push(`/agent/${agentId}/dashboard`);
} else {
  router.push('/dashboard');
}
```

## Testing

To test both modes locally:

### Standalone Mode
```bash
cd CIRISGUI/apps/agui
npm run dev
# Access at http://localhost:3000
```

### Managed Mode Simulation
```bash
# Access at http://localhost:3000/agent/datum
# GUI will detect managed mode and adjust API paths
```

## Migration Path

For users migrating from standalone to managed:

1. Deploy CIRISManager alongside existing agent
2. CIRISManager nginx automatically takes over routing
3. Users access same functionality at `/agent/{agent_id}`
4. Original URLs redirect to appropriate locations

This dual-mode approach ensures smooth transitions and maximum flexibility for different deployment scenarios.
