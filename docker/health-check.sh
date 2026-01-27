#!/bin/bash

# Health check script for container orchestration
# Returns 0 if healthy, 1 if unhealthy

set -e

PORT=${PORT:-8080}
TIMEOUT=${HEALTH_CHECK_TIMEOUT:-3}
RETRIES=${HEALTH_CHECK_RETRIES:-3}

check_health() {
    local attempt=1
    while [ $attempt -le $RETRIES ]; do
        if curl -f -s -m $TIMEOUT http://localhost:$PORT/health > /dev/null 2>&1; then
            echo "Health check passed (attempt $attempt/$RETRIES)"
            return 0
        fi
        
        echo "Health check attempt $attempt/$RETRIES failed"
        attempt=$((attempt + 1))
        
        if [ $attempt -le $RETRIES ]; then
            sleep 1
        fi
    done
    
    return 1
}

check_health
