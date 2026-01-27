#!/bin/bash

# Operations guide for MCP Proxy

## Local Development

### Prerequisites
- Node.js 20.x
- npm or yarn

### Setup
```bash
npm install
npm run build
```

### Running Locally
```bash
npm run dev
```

Server will start on http://localhost:8080

### Testing
```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Coverage report
npm run test:coverage
```

## Docker Deployment

### Building Image
```bash
docker build -t mcp-proxy:latest .
```

### Running Container
```bash
docker run -d \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e CONFIG_FILE=/app/config/docker.json \
  -v $(pwd)/config:/app/config \
  --name mcp-proxy \
  mcp-proxy:latest
```

### Docker Compose
```bash
docker-compose up -d
```

## Kubernetes Deployment

### Prerequisites
- kubectl configured for AKS cluster
- Docker image pushed to registry

### Deploying
```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/serviceaccount.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/pdb.yaml
```

### Checking Status
```bash
kubectl get pods -l app=mcp-proxy
kubectl logs -f deployment/mcp-proxy
kubectl describe service mcp-proxy
```

### Scaling
```bash
# Manual scaling
kubectl scale deployment mcp-proxy --replicas=5

# Auto-scaling is handled by HPA (2-10 replicas)
```

## Monitoring

### Health Check
```bash
curl http://localhost:8080/health
```

### Metrics
```bash
curl http://localhost:8080/metrics
```

Metrics are in Prometheus format. Can be scraped by Prometheus or similar tools.

### Configuration Management
```bash
# Get current config
curl http://localhost:8080/config

# Update config
curl -X POST http://localhost:8080/config \
  -H "Content-Type: application/json" \
  -d @config/docker.json
```

## Troubleshooting

### Check Logs
```bash
# Docker
docker logs mcp-proxy

# Kubernetes
kubectl logs deployment/mcp-proxy -f

# Local
npm run dev
```

### Common Issues

#### Port Already in Use
```bash
# Find process using port
lsof -i :8080

# Kill process
kill -9 <PID>
```

#### Config Errors
- Check config file syntax (valid JSON)
- Validate MCP server URLs are reachable
- Verify filter and transformation expressions

#### Memory Issues
- Increase container memory limits
- Check for memory leaks in plugins
- Enable memory profiling

## Performance Tuning

### Resource Limits
Adjust in k8s/deployment.yaml:
```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Request Timeout
Configure in config file:
```json
{
  "mcpServers": [{
    "timeout": 30000
  }]
}
```

### Connection Pooling
Adjust Node.js environment:
```bash
export NODE_POOL_SIZE=10
```

## Backup and Recovery

### Config Backup
```bash
kubectl get configmap mcp-proxy-config -o yaml > backup.yaml
```

### Restore Config
```bash
kubectl apply -f backup.yaml
```

## Updates and Upgrades

### Rolling Update
```bash
kubectl set image deployment/mcp-proxy \
  mcp-proxy=mcp-proxy:v2.0.0 \
  --record
```

### Rollback
```bash
kubectl rollout undo deployment/mcp-proxy
```

## Support

For issues and questions:
- Check logs for error messages
- Review configuration validity
- Verify backend MCP server connectivity
- Contact operations team
