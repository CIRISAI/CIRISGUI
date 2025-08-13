# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the CIRISGUI repository.

## Project Context

CIRISGUI is the unified web interface for the CIRIS AI platform, providing:
- **Next.js 14 Frontend**: Modern React-based UI with TypeScript
- **Complete SDK**: Full TypeScript SDK for CIRIS API integration
- **Dual-Mode Deployment**: Standalone or CIRISManager-managed
- **OAuth Integration**: Google/Discord authentication support
- **Real-time Updates**: WebSocket support for live agent interactions

## Architecture Overview

### Monorepo Structure
```
CIRISGUI/
├── apps/
│   ├── agui/          # Next.js 14 frontend application
│   └── ciris-api/     # Python API runtime wrapper
├── docker/            # Docker configurations
├── scripts/           # Development and deployment scripts
└── packages/          # Shared packages (future)
```

### Key Technologies
- **Frontend**: Next.js 14, React 19, TypeScript, Tailwind CSS
- **SDK**: Complete TypeScript client for CIRIS API v1.0
- **Authentication**: JWT-based with OAuth2 support
- **Deployment**: Docker, GitHub Actions CI/CD
- **Package Manager**: pnpm for workspaces

## Development Guidelines

### Local Development
```bash
# Install dependencies
cd apps/agui
pnpm install

# Run development server
pnpm dev  # Runs on http://localhost:3000

# Build for production
pnpm build
pnpm start
```

### Environment Variables
```bash
# Required for API connection
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080  # CIRIS API endpoint
NEXT_PUBLIC_MANAGER_URL=http://localhost:8888   # CIRISManager endpoint (optional)

# OAuth configuration (production)
NEXT_PUBLIC_OAUTH_CLIENT_ID=your-client-id
NEXT_PUBLIC_OAUTH_REDIRECT_URI=https://agents.ciris.ai/oauth/callback
```

## SDK Usage

The CIRIS SDK is located in `apps/agui/lib/ciris-sdk/` and provides:

### Complete API Coverage
- 78+ methods across 12 resource modules
- Full TypeScript type safety
- Automatic token management
- WebSocket support for real-time updates

### Example Usage
```typescript
import { CIRISClient } from '@/lib/ciris-sdk';

const client = new CIRISClient({ 
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL 
});

// Authentication
await client.auth.login('admin', 'password');

// Agent interaction
const response = await client.agent.interact({
  message: "Hello CIRIS",
  channel_id: "web_ui"
});

// System monitoring
const health = await client.system.getHealth();
const queue = await client.system.getProcessingQueueStatus();
```

## Component Architecture

### Key Components
- **AgentSelector**: Dynamic agent discovery and selection
- **ProtectedRoute**: Authentication-aware route protection
- **ManagerProtectedRoute**: CIRISManager-specific routes
- **PermissionRequest**: OAuth permission flow UI

### Context Providers
- **AuthContext**: JWT token management
- **AgentContext**: Active agent state management

### Pages Structure
```
app/
├── agents/         # Agent management
├── audit/          # Audit trail viewer
├── config/         # Configuration management
├── memory/         # Memory graph visualization
├── system/         # System monitoring
├── runtime/        # Runtime control
├── services/       # Service health dashboard
├── manager/        # CIRISManager integration
└── oauth/          # OAuth callback handlers
```

## Deployment Modes

### 1. Standalone Mode
Direct connection to CIRIS API:
```yaml
services:
  ciris-gui:
    image: ghcr.io/cirisai/ciris-gui:latest
    environment:
      - NEXT_PUBLIC_API_BASE_URL=http://ciris-api:8080
    ports:
      - "3000:3000"
```

### 2. Manager Mode
Integration with CIRISManager:
```yaml
services:
  ciris-gui:
    image: ghcr.io/cirisai/ciris-gui:latest
    environment:
      - NEXT_PUBLIC_API_BASE_URL=http://ciris-api:8080
      - NEXT_PUBLIC_MANAGER_URL=http://ciris-manager:8888
    ports:
      - "3000:3000"
```

## CI/CD Pipeline

### Build Process
1. **Test**: Run Jest tests for components
2. **Build**: Next.js production build
3. **Docker**: Build container image
4. **Push**: Push to GitHub Container Registry

### Deployment
- **Production**: Automatic deployment on main branch
- **Images**: `ghcr.io/cirisai/ciris-gui:latest`
- **Notification**: CIRISManager orchestrates updates

## Testing

### Unit Tests
```bash
cd apps/agui
pnpm test
```

### SDK Integration Tests
```bash
node test-sdk-all-methods.js
```

### OAuth Flow Tests
```bash
node test-oauth-flow-simulation.js
```

## Security Considerations

### Authentication
- JWT tokens with automatic refresh
- OAuth2 integration for production
- Role-based access control (OBSERVER/ADMIN/AUTHORITY/SYSTEM_ADMIN)

### API Security
- All API calls require authentication
- Emergency endpoints bypass auth (with Ed25519 signatures)
- CORS configuration for production domains

## Performance Optimization

### Next.js Optimizations
- Image optimization with next/image
- Code splitting and lazy loading
- Static generation where possible
- API route caching

### Bundle Size
- Tree shaking enabled
- Dynamic imports for heavy components
- Minimal dependencies

## Common Issues and Solutions

### CORS Errors
Ensure API allows origin:
```python
# In CIRIS API
CORS(app, origins=["http://localhost:3000", "https://agents.ciris.ai"])
```

### WebSocket Connection
Check WebSocket upgrade headers:
```typescript
const ws = new WebSocket(`ws://localhost:8080/v1/ws`);
ws.onopen = () => console.log('Connected');
```

### OAuth Callback
Ensure redirect URI matches exactly:
```
https://agents.ciris.ai/oauth/{agent_id}/{provider}/callback
```

## Development Best Practices

### Type Safety
- Always use TypeScript interfaces
- Avoid `any` types
- Define API response types

### Component Guidelines
- Keep components small and focused
- Use composition over inheritance
- Implement proper error boundaries

### State Management
- Use React Query for server state
- Context for global UI state
- Local state for component-specific data

## Monitoring and Debugging

### Development Tools
- React Developer Tools
- Redux DevTools (if using Redux)
- Network tab for API debugging

### Production Monitoring
- Error boundaries with reporting
- Performance monitoring
- User analytics (privacy-respecting)

## Future Enhancements

### Planned Features
- [ ] Real-time collaboration
- [ ] Advanced memory visualization
- [ ] Plugin system for custom tools
- [ ] Mobile-responsive design improvements
- [ ] Offline mode with service workers

### Technical Debt
- [ ] Migrate to App Router fully
- [ ] Implement comprehensive E2E tests
- [ ] Add Storybook for component documentation
- [ ] Optimize bundle size further

## Contributing

### Code Style
- Follow existing patterns
- Use Prettier for formatting
- ESLint for linting
- Conventional commits

### Pull Request Process
1. Create feature branch
2. Write tests
3. Update documentation
4. Submit PR with clear description

## Resources

- **CIRIS Documentation**: See CIRISAgent/CLAUDE.md
- **Next.js Docs**: https://nextjs.org/docs
- **TypeScript**: https://www.typescriptlang.org/docs
- **Tailwind CSS**: https://tailwindcss.com/docs

Remember: The GUI is the face of CIRIS - make it intuitive, responsive, and delightful to use!