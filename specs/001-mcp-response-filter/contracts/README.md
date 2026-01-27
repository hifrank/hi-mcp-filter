# API Contracts: MCP Response Filter Proxy

This directory contains API contracts for the proxy server endpoints.

## Endpoints

### 1. Health Check
- **File**: [health-check.md](health-check.md)
- **Purpose**: Kubernetes/load balancer health probe endpoint

### 2. Proxy Endpoint
- **File**: [proxy-endpoint.md](proxy-endpoint.md)
- **Purpose**: Main proxy passthrough for MCP requests/responses

### 3. Configuration Management API (Optional P3)
- **File**: [config-api.md](config-api.md)
- **Purpose**: Hot-reload trigger and config status endpoints

### 4. Metrics Endpoint (Optional)
- **File**: [metrics.md](metrics.md)
- **Purpose**: Prometheus-compatible metrics for observability

---

## Contract Format

Each contract document includes:
- HTTP method and path
- Request schema (headers, body)
- Response schema (success and error cases)
- Status codes
- Examples
- Error handling behavior
