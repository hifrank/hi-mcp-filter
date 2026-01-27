# Contract: Health Check Endpoint

**Endpoint**: `GET /health`  
**Purpose**: Kubernetes liveness/readiness probe  
**Priority**: P1 (User Story 1)

## Request

```http
GET /health HTTP/1.1
Host: proxy:8080
```

**Headers**: None required

**Body**: None

---

## Response

### Success (200 OK)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": 1706380800000,
  "version": "1.0.0"
}
```

**Fields**:
- `status`: string ("healthy" | "degraded" | "unhealthy")
- `uptime`: number (seconds since proxy started)
- `timestamp`: number (current Unix timestamp ms)
- `version`: string (proxy version)

### Degraded (200 OK)

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "degraded",
  "uptime": 3600,
  "timestamp": 1706380800000,
  "version": "1.0.0",
  "warnings": [
    "Plugin 'rate-limiter' failed to load",
    "2 of 3 backend MCP servers unreachable"
  ]
}
```

Returns 200 but indicates non-fatal issues. Load balancer may keep instance in rotation but with lower priority.

### Unhealthy (503 Service Unavailable)

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "status": "unhealthy",
  "uptime": 3600,
  "timestamp": 1706380800000,
  "version": "1.0.0",
  "errors": [
    "Configuration failed to load",
    "All backend MCP servers unreachable"
  ]
}
```

Returns 503 when proxy cannot handle requests. Load balancer removes instance from rotation.

---

## Status Codes

- `200 OK`: Proxy is healthy or degraded but functional
- `503 Service Unavailable`: Proxy is unhealthy and cannot process requests

---

## Error Handling

- Health check MUST NOT fail due to transient issues (e.g., single backend timeout)
- Health check MUST complete in <3 seconds (Kubernetes default timeout)
- Health check MUST NOT block on external dependencies (async checks)

---

## Implementation Notes

- Called every 30 seconds by Kubernetes (configurable)
- Used for both liveness (restart unhealthy pods) and readiness (route traffic)
- Startup period: 5 seconds (allow proxy to initialize before first health check)
- Failure threshold: 3 consecutive failures trigger pod restart

---

## Example Usage

```bash
# Manual health check
curl http://localhost:8080/health

# Kubernetes liveness probe
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 30
  timeoutSeconds: 3
  failureThreshold: 3

# Kubernetes readiness probe  
readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 10
  timeoutSeconds: 3
  failureThreshold: 2
```
