#!/bin/bash
# Development startup script for CIRISGui with SDK integration

set -e

echo "Starting CIRISGui Development Environment..."

# Check if CIRIS Engine is running
ENGINE_URL="${CIRIS_ENGINE_URL:-http://localhost:8080}"
echo "Checking CIRIS Engine at $ENGINE_URL..."

if ! curl -s "$ENGINE_URL/health" > /dev/null; then
    echo "Warning: CIRIS Engine is not running at $ENGINE_URL"
    echo "Please start the engine first with: docker-compose up -d"
fi

# Start the API wrapper (backend)
echo "Starting API wrapper..."
cd apps/ciris-api
poetry install
CIRIS_ENGINE_URL=$ENGINE_URL poetry run uvicorn main:app --reload --port 8081 &
API_PID=$!

# Wait for API to start
echo "Waiting for API to start..."
sleep 5

# Start the Next.js frontend
echo "Starting frontend..."
cd ../agui
pnpm install
NEXT_PUBLIC_API_URL=http://localhost:8081 pnpm dev &
FRONTEND_PID=$!

echo ""
echo "CIRISGui is starting..."
echo "- Frontend: http://localhost:3000"
echo "- API Wrapper: http://localhost:8081"
echo "- CIRIS Engine: $ENGINE_URL"
echo ""
echo "Default login: admin / ciris_admin_password"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for interrupt
trap "kill $API_PID $FRONTEND_PID; exit" INT
wait
