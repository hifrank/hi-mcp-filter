# Quickstart: MCP Response Filter Proxy

**Feature**: MCP Response Filter Proxy  
**Created**: 2026-01-27  
**Audience**: Developers, DevOps Engineers

## Overview

The MCP Response Filter Proxy sits between Azure API Management and Model Context Protocol (MCP) servers, providing filtering, transformation, and custom business logic capabilities for MCP responses.

**Use Cases**:
- Block responses from specific tools or services
- Redact sensitive data (API keys, PII) from responses
- Reshape response structures for downstream clients
- Apply custom rate limiting or authentication logic
- Audit all MCP traffic for compliance

---

## Prerequisites

- **Node.js 20.x LTS** installed
- **Docker** and **Docker Compose** installed (for containerized deployment)
- **Backend MCP Server** accessible via HTTP (for testing)
- **Azure API Management** configured to route traffic through proxy (production)

---

## Quick Start (Local Development)

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/your-org/hi-mcp-filter.git
cd hi-mcp-filter

# Install dependencies
npm install

# Copy example configuration
cp config/proxy.example.json config/proxy.json
cp config/filters.example.json config/filters.json
cp config/transforms.example.json config/transforms.json
```

### 2. Configure Proxy

Edit `config/proxy.json`:

```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  },
  "mcpServers": [
    {
      "id": "mcp-server-1",
      "url": "http://localhost:5000",
      "timeout": 5000
    }
  ],
  "logging": {
    "level": "info",
    "format": "pretty"
  },
  "hotReload": {
    "enabled": true,
    "debounceMs": 1000
  }
}
```

### 3. Add Filter Rules

Edit `config/filters.json`:

```json
[
  {
    "id": "filter-001",
    "name": "Block dangerous tools",
    "enabled": true,
    "condition": {
      "field": "$.result.toolName",
      "operator": "equals",
      "value": "dangerous_tool"
    },
    "action": "drop",
    "composition": "NONE",
    "priority": 1
  }
]
```

### 4. Add Transformation Rules

Edit `config/transforms.json`:

```json
[
  {
    "id": "transform-001",
    "name": "Redact API keys",
    "enabled": true,
    "expression": "$ ~> |result.content|{'api_key': '[REDACTED]'}|",
    "order": 1,
    "onError": "passthrough"
  }
]
```

### 5. Start Proxy

```bash
# Development mode (with hot-reload)
npm run dev

# Production mode
npm start
```

**Output**:
```
[INFO] Proxy server started on http://0.0.0.0:8080
[INFO] Loaded 1 filter rules
[INFO] Loaded 1 transformation rules
[INFO] Hot-reload enabled, watching config files
[INFO] Health check available at /health
```

### 6. Test Proxy

```bash
# Health check
curl http://localhost:8080/health

# Send test request
curl -X POST http://localhost:8080/proxy/mcp-server-1 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {"name": "calculator", "arguments": {"op": "add", "a": 1, "b": 2}},
    "id": "test-001"
  }'
```

---

## Docker Deployment (Local)

### 1. Build Docker Image

```bash
# Build production image
docker build -t mcp-filter-proxy:latest -f docker/Dockerfile .

# Or use Docker Compose (includes mock MCP server)
docker-compose up --build
```

### 2. Run Container

```bash
docker run -d \
  --name mcp-proxy \
  -p 8080:8080 \
  -v $(pwd)/config:/app/config \
  -e NODE_ENV=production \
  -e CONFIG_PATH=/app/config/proxy.json \
  mcp-filter-proxy:latest
```

### 3. Verify

```bash
# Check logs
docker logs mcp-proxy

# Health check
curl http://localhost:8080/health
```

---

## Azure Container Apps Deployment

### 1. Build and Push Image

```bash
# Login to Azure Container Registry
az acr login --name yourregistry

# Build and push
docker build -t yourregistry.azurecr.io/mcp-filter-proxy:v1.0.0 -f docker/Dockerfile .
docker push yourregistry.azurecr.io/mcp-filter-proxy:v1.0.0
```

### 2. Deploy to Container Apps

```bash
# Create Container App
az containerapp create \
  --name mcp-filter-proxy \
  --resource-group your-rg \
  --environment your-env \
  --image yourregistry.azurecr.io/mcp-filter-proxy:v1.0.0 \
  --target-port 8080 \
  --ingress external \
  --min-replicas 2 \
  --max-replicas 10 \
  --cpu 1.0 \
  --memory 2.0Gi \
  --env-vars \
    NODE_ENV=production \
    CONFIG_PATH=/app/config/proxy.json
```

### 3. Configure Health Probes

Edit Container App health probes via Azure Portal:

- **Liveness Probe**: `GET /health`, interval: 30s, timeout: 3s
- **Readiness Probe**: `GET /health`, interval: 10s, timeout: 3s

---

## AKS Deployment

### 1. Create Kubernetes Deployment

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-filter-proxy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-filter-proxy
  template:
    metadata:
      labels:
        app: mcp-filter-proxy
    spec:
      containers:
      - name: proxy
        image: yourregistry.azurecr.io/mcp-filter-proxy:v1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: "production"
        - name: CONFIG_PATH
          value: "/app/config/proxy.json"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 30
          timeoutSeconds: 3
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 2
        volumeMounts:
        - name: config
          mountPath: /app/config
      volumes:
      - name: config
        configMap:
          name: proxy-config
```

### 2. Create Service

Create `k8s/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mcp-filter-proxy
spec:
  selector:
    app: mcp-filter-proxy
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080
  type: LoadBalancer
```

### 3. Deploy

```bash
# Create ConfigMap from config files
kubectl create configmap proxy-config \
  --from-file=config/proxy.json \
  --from-file=config/filters.json \
  --from-file=config/transforms.json

# Deploy
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Verify
kubectl get pods
kubectl get svc mcp-filter-proxy
```

---

## Custom Plugins

### 1. Create Plugin

Create `plugins/rate-limiter.js`:

```javascript
const rateLimit = new Map();

module.exports = {
  name: 'rate-limiter',
  version: '1.0.0',
  
  async filter(context) {
    const userId = context.request.headers['x-user-id'];
    
    if (!userId) {
      return {action: 'allow'};
    }
    
    const key = `${userId}:${Date.now() / 60000 | 0}`;
    const count = (rateLimit.get(key) || 0) + 1;
    rateLimit.set(key, count);
    
    if (count > 100) {
      context.logger.warn(`Rate limit exceeded for user ${userId}`);
      return {
        action: 'drop',
        reason: `Rate limit exceeded: ${count}/100 requests per minute`
      };
    }
    
    return {action: 'allow'};
  }
};
```

### 2. Register Plugin

Edit `config/proxy.json`:

```json
{
  "plugins": [
    {
      "name": "rate-limiter",
      "filePath": "./plugins/rate-limiter.js",
      "enabled": true,
      "errorBehavior": "fail-open",
      "timeout": 5000
    }
  ]
}
```

### 3. Test Plugin

```bash
# Restart proxy to load plugin
npm run dev

# Send request with user ID
curl -X POST http://localhost:8080/proxy/mcp-server-1 \
  -H "Content-Type: application/json" \
  -H "X-User-ID: user-123" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{},"id":"1"}'
```

---

## Configuration Hot-Reload

```bash
# Edit filter rules
vim config/filters.json

# Save changes - proxy detects and reloads automatically
# Check logs:
# [INFO] Configuration change detected in filters.json
# [INFO] Validating new configuration...
# [INFO] Configuration reload successful (42ms)
```

No restart required! In-flight requests use old config, new requests use new config.

---

## Monitoring

### Metrics (Prometheus)

If Prometheus metrics enabled:

```bash
# Scrape metrics
curl http://localhost:8080/metrics
```

**Key Metrics**:
- `proxy_requests_total` - Total requests processed
- `proxy_filtered_requests_total` - Requests blocked by filters
- `proxy_latency_seconds` - Proxy processing latency histogram
- `proxy_plugin_executions_total` - Plugin invocation count

### Logs

Structured logging in JSON format (production) or pretty format (development):

```json
{
  "level": "info",
  "time": 1706380800000,
  "msg": "Request filtered",
  "requestId": "abc-123",
  "filterId": "filter-001",
  "filterName": "Block dangerous tools",
  "serverId": "mcp-server-1"
}
```

---

## Troubleshooting

### Proxy Won't Start

**Check logs**:
```bash
npm run dev
```

**Common issues**:
- Port 8080 already in use → Change `server.port` in config
- Invalid config JSON → Validate with `npm run validate-config`
- Missing dependencies → Run `npm install`

### Responses Not Filtered

- Verify filter rules in `config/filters.json`
- Check `enabled: true` on filter rules
- Verify JSONPath expression matches response structure
- Check logs for filter evaluation results

### Performance Issues

- Check `X-Proxy-Latency-Ms` header in responses
- Review filter/transformation complexity (JSONPath, JSONata)
- Monitor memory usage (`docker stats` or `kubectl top pods`)
- Consider increasing resource limits in AKS/Container Apps

---

## Next Steps

- Review [API Contracts](contracts/README.md) for endpoint details
- Read [Plugin API Documentation](../docs/plugin-api.md) for custom logic
- See [Operations Guide](../docs/operations.md) for production deployment best practices
