# API Contracts: MCP SSE Transport Support

This directory contains API contracts for SSE transport integration.

## Endpoints

### 1. SSE-enabled Proxy Endpoint
- **File**: [sse-proxy-endpoint.md](sse-proxy-endpoint.md)
- **Purpose**: Proxy endpoint with SSE transport support

### 2. Transport Configuration API
- **File**: [transport-config.md](transport-config.md)
- **Purpose**: Configure transport type per MCP server

---

## Contract Format

Each contract document includes:
- HTTP method and path
- Request schema (headers, body, query params)
- Response schema (success and error cases for both HTTP and SSE)
- Status codes
- Examples for both transports
- SSE-specific error handling behavior
