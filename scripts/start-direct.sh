#!/bin/bash
# Start script for CIRISGUI with direct API connection

echo "🚀 Starting CIRISGUI with direct API connection..."

# Check if we're in the right directory
if [ ! -f "docker/docker-compose-direct.yml" ]; then
    echo "❌ Error: Must run from CIRISGUI directory"
    exit 1
fi

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker/docker-compose-direct.yml down

# Build and start containers
echo "🔨 Building containers..."
docker-compose -f docker/docker-compose-direct.yml build

echo "🚀 Starting services..."
docker-compose -f docker/docker-compose-direct.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check health
echo "🏥 Checking service health..."
curl -s http://localhost:8080/v1/system/health > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ API is healthy!"
else
    echo "❌ API health check failed"
fi

echo ""
echo "🎉 CIRISGUI is ready!"
echo "   - Web UI: http://localhost:3000"
echo "   - API: http://localhost:8080"
echo ""
echo "📋 Default credentials:"
echo "   - Username: admin"
echo "   - Password: ciris_admin_password"
echo ""
echo "To view logs: docker-compose -f docker/docker-compose-direct.yml logs -f"
echo "To stop: docker-compose -f docker/docker-compose-direct.yml down"
