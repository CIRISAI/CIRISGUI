"""
CIRIS API wrapper with SDK integration for the GUI.
Provides authentication and proxies requests to the CIRIS Engine.
"""

import asyncio
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from ciris_sdk import CIRISClient
from ciris_sdk.exceptions import CIRISAuthError

# Global client instance
client: Optional[CIRISClient] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize and cleanup SDK client."""
    global client
    # Get CIRIS Engine URL from environment
    engine_url = os.getenv("CIRIS_ENGINE_URL", "http://localhost:8080")
    client = CIRISClient(base_url=engine_url, use_auth_store=True)
    await client.__aenter__()
    yield
    await client.__aexit__(None, None, None)


app = FastAPI(
    title="CIRIS GUI API",
    description="API wrapper for CIRIS GUI with SDK integration",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Authentication dependency
async def get_current_user(request: Request):
    """Get current user from session."""
    # In production, use proper session management
    # For now, check if client has auth token
    if not client or not await client.auth.is_authenticated():
        return None

    try:
        return await client.auth.get_current_user()
    except Exception:
        return None


async def require_auth(user=Depends(get_current_user)):
    """Require authenticated user."""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_role(role: str):
    """Require specific role."""

    async def check_role(user=Depends(require_auth)):
        if user.role not in [role, "SYSTEM_ADMIN"]:
            raise HTTPException(status_code=403, detail=f"Requires {role} role")
        return user

    return check_role


# Auth endpoints
@app.post("/api/auth/login")
async def login(username: str, password: str):
    """Login and get user info."""
    try:
        await client.login(username, password)
        user = await client.auth.get_current_user()
        return {"user": user.model_dump()}
    except CIRISAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.post("/api/auth/logout")
async def logout():
    """Logout current user."""
    await client.logout()
    return {"message": "Logged out"}


@app.get("/api/auth/me")
async def get_me(user=Depends(get_current_user)):
    """Get current user info."""
    if not user:
        return {"user": None}
    return {"user": user.model_dump()}


# Agent endpoints
@app.post("/api/agent/interact")
async def interact(message: str, context: Optional[dict] = None):
    """Send message to agent."""
    response = await client.interact(message, context=context)
    return response.model_dump()


@app.get("/api/agent/history")
async def get_history(limit: int = 50):
    """Get conversation history."""
    history = await client.history(limit=limit)
    return history.model_dump()


@app.get("/api/agent/status")
async def get_status():
    """Get agent status."""
    status = await client.status()
    return status.model_dump()


@app.get("/api/agent/identity")
async def get_identity():
    """Get agent identity."""
    identity = await client.identity()
    return identity.model_dump()


# Memory endpoints
@app.post("/api/memory/query")
async def query_memory(query: str, limit: int = 20):
    """Query memory graph."""
    results = await client.memory.query(query, limit=limit)
    return {"nodes": [r.model_dump() for r in results]}


@app.get("/api/memory/node/{node_id}")
async def get_node(node_id: str):
    """Get specific memory node."""
    node = await client.memory.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node.model_dump()


# System endpoints
@app.get("/api/system/health")
async def get_health():
    """Get system health."""
    health = await client.system.health()
    return health.model_dump()


@app.get("/api/system/services")
async def get_services():
    """Get service statuses."""
    services = await client.system.services()
    return {"services": [s.model_dump() for s in services]}


@app.get("/api/system/resources")
async def get_resources():
    """Get resource usage."""
    resources = await client.system.resources()
    return resources.model_dump()


@app.post("/api/system/runtime/{action}")
async def runtime_control(action: str, user=Depends(require_role("ADMIN"))):
    """Control runtime (pause/resume)."""
    if action not in ["pause", "resume"]:
        raise HTTPException(status_code=400, detail="Invalid action")

    if action == "pause":
        result = await client.system.pause()
    else:
        result = await client.system.resume()

    return result.model_dump()


# Telemetry endpoints
@app.get("/api/telemetry/logs")
async def get_logs(level: Optional[str] = None, service: Optional[str] = None, limit: int = 100):
    """Get system logs."""
    logs = await client.telemetry.logs(level=level, service=service, limit=limit)
    return {"logs": [log.model_dump() for log in logs]}


@app.get("/api/telemetry/metrics")
async def get_metrics(
    metric_type: Optional[str] = None, start_time: Optional[str] = None, end_time: Optional[str] = None
):
    """Get system metrics."""
    metrics = await client.telemetry.metrics(metric_type=metric_type, start_time=start_time, end_time=end_time)
    return {"metrics": [m.model_dump() for m in metrics]}


# Audit endpoints
@app.get("/api/audit/trail")
async def get_audit_trail(action_type: Optional[str] = None, user_id: Optional[str] = None, limit: int = 100):
    """Get audit trail."""
    entries = await client.audit.query(action_type=action_type, user_id=user_id, limit=limit)
    return {"entries": [e.model_dump() for e in entries]}


# Config endpoints (ADMIN only)
@app.get("/api/config")
async def get_config(user=Depends(require_role("ADMIN"))):
    """Get current configuration."""
    config = await client.config.get()
    return config.model_dump()


@app.patch("/api/config")
async def update_config(updates: dict, user=Depends(require_role("ADMIN"))):
    """Update configuration."""
    result = await client.config.patch(updates)
    return result.model_dump()


# WA endpoints (AUTHORITY only)
@app.get("/api/wa/deferrals")
async def get_deferrals(user=Depends(require_role("AUTHORITY"))):
    """Get deferred decisions."""
    deferrals = await client.wa.get_deferrals()
    return {"deferrals": [d.model_dump() for d in deferrals]}


@app.post("/api/wa/resolve/{deferral_id}")
async def resolve_deferral(deferral_id: str, decision: str, reasoning: str, user=Depends(require_role("AUTHORITY"))):
    """Resolve a deferred decision."""
    result = await client.wa.resolve_deferral(deferral_id=deferral_id, decision=decision, reasoning=reasoning)
    return result.model_dump()


# Emergency endpoint (SYSTEM_ADMIN only)
@app.post("/api/emergency/shutdown")
async def emergency_shutdown(reason: str, signature: str, user=Depends(require_role("SYSTEM_ADMIN"))):
    """Emergency shutdown with Ed25519 signature."""
    result = await client.emergency.shutdown(reason=reason, signature=signature, initiator=user.username)
    return result.model_dump()


# WebSocket endpoint for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket):
    """WebSocket for real-time updates."""
    await websocket.accept()

    # Create WebSocket client
    ws_client = await client.websocket()

    try:
        # Handle incoming messages (subscriptions)
        async def handle_client_messages():
            async for message in websocket.iter_json():
                if message.get("type") == "subscribe":
                    channel = message.get("channel")
                    if channel:
                        await ws_client.subscribe(channel)
                elif message.get("type") == "unsubscribe":
                    channel = message.get("channel")
                    if channel:
                        await ws_client.unsubscribe(channel)

        # Forward events to client
        async def forward_events():
            async for event in ws_client:
                await websocket.send_json(event)

        # Run both tasks concurrently
        await asyncio.gather(handle_client_messages(), forward_events())
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await ws_client.close()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8081)
