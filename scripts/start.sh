#!/usr/bin/env bash
set -e
# Set the root directory for the project
ROOT_DIR="$(dirname "$0")/../.."

# Kill any existing processes first
pkill -f "python.*main.py" || true
pkill -f "next.*dev" || true
pkill -f "pnpm.*dev" || true

# Source environment variables
if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    # Use "." instead of "source" for POSIX sh compatibility
    . "$ROOT_DIR/.env"
    set +a
    echo "Sourced .env file"
fi

# Check for pnpm and install if missing
if ! command -v pnpm >/dev/null 2>&1; then
    echo "pnpm not found. Installing..."
    npm install -g pnpm || { echo "Failed to install pnpm. Please install it manually."; exit 1; }
fi

# Start CIRISAgent API with correct Python path
cd "$ROOT_DIR"
PYTHONPATH="$ROOT_DIR:$PYTHONPATH" python3 CIRISGUI/apps/ciris-api/main.py &
API_PID=$!

# Wait for API to be available
API_URL="${NEXT_PUBLIC_CIRIS_API_URL:-http://localhost:8080}"
MAX_WAIT=30
WAITED=0
printf "Waiting for CIRIS API backend at $API_URL/v1/status "
while ! curl -s --max-time 2 "$API_URL/v1/status" | grep -q '"status"'; do
    sleep 1
    WAITED=$((WAITED+1))
    printf "."
    if [ $WAITED -ge $MAX_WAIT ]; then
        echo "\n[ERROR] CIRIS API backend did not start within $MAX_WAIT seconds."
        kill $API_PID 2>/dev/null || true
        exit 1
    fi
    # Check if API process died
    if ! kill -0 $API_PID 2>/dev/null; then
        echo "\n[ERROR] CIRIS API backend process exited unexpectedly."
        exit 1
    fi
    # Optionally print logs here for debugging
    # tail -n 10 "$ROOT_DIR/logs/latest.log" 2>/dev/null
    # Uncomment above if you want log tailing
    # (spinner dots already printed)
done
printf " done!\n"

# Start Next.js
cd "$(dirname "$0")/../apps/agui" && pnpm dev --port 3000 &
WEB_PID=$!

trap "echo 'Stopping…'; kill $API_PID $WEB_PID" INT
wait $API_PID $WEB_PID
