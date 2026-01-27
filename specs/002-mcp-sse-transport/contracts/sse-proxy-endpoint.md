# Contract: SSE-enabled Proxy Endpoint

**Endpoint**: `POST /proxy/:serverId`  
**Purpose**: Forward MCP requests to backend servers with SSE or HTTP transport  
**Priority**: P1 (User Story 1, 2)

## Request

```http
POST /proxy/azure-apim HTTP/1.1
Host: proxy:8080
Content-Type: application/json
X-Request-ID: abc-123-def

{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {"name": "test-client", "version": "1.0.0"}
  },
  "id": 1
}
```

**Path Parameters**:
- `serverId`: string (backend MCP server identifier from config)

**Headers**:
- `Content-Type`: `application/json` (required)
- `X-Request-ID`: string (optional, for request tracing)

**Body**: MCP JSON-RPC 2.0 request

---

## Response (SSE Transport)

### Success (200 OK - SSE Backend, JSON Response to Client)

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Proxy-Filtered: false
X-Proxy-Transformed: false
X-Proxy-Latency-Ms: 52
X-Proxy-Transport: sse

{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {"tools": {"listChanged": true}},
    "serverInfo": {"name": "Azure API Management", "version": "1.0.0"}
  }
}
```

**Response Headers**:
- `X-Proxy-Transport`: "sse" | "http" (indicates backend transport used)
- `X-Proxy-Latency-Ms`: number (proxy processing time including SSE parsing)
- `X-Proxy-Filtered`: boolean (filter rules applied)
- `X-Proxy-Transformed`: boolean (transformations applied)

**Body**: Extracted JSON-RPC message from SSE `data:` field

---

## Response (HTTP Transport)

### Success (200 OK - HTTP Backend, JSON Response)

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Proxy-Transport: http
X-Proxy-Latency-Ms: 35

{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {...}
}
```

Same format as existing proxy endpoint, with `X-Proxy-Transport: http` header.

---

## Error Responses

### SSE Parsing Error (502 Bad Gateway)

```http
HTTP/1.1 502 Bad Gateway
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "Backend SSE stream error",
    "data": {
      "serverId": "azure-apim",
      "transport": "sse",
      "reason": "Invalid JSON in SSE data field",
      "eventData": "data: {invalid json..."
    }
  }
}
```

Returned when SSE stream contains malformed events or invalid JSON-RPC data.

---

### SSE Timeout (504 Gateway Timeout)

```http
HTTP/1.1 504 Gateway Timeout
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32002,
    "message": "SSE stream timeout",
    "data": {
      "serverId": "azure-apim",
      "transport": "sse",
      "timeoutMs": 30000,
      "eventsReceived": 0
    }
  }
}
```

Returned when SSE stream doesn't send events within configured timeout.

---

### Transport Auto-detection Failure (502 Bad Gateway)

```http
HTTP/1.1 502 Bad Gateway
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "Unsupported backend transport",
    "data": {
      "serverId": "unknown-server",
      "contentType": "text/html",
      "reason": "Expected application/json or text/event-stream"
    }
  }
}
```

Returned when backend returns unexpected Content-Type and auto-detection fails.

---

## Status Codes

- `200 OK`: Request successfully processed (both HTTP and SSE backends)
- `400 Bad Request`: Invalid MCP request format
- `403 Forbidden`: Response blocked by filter rules (applies to SSE responses too)
- `404 Not Found`: Specified `serverId` not configured
- `500 Internal Server Error`: Proxy internal error
- `502 Bad Gateway`: Backend error (SSE parsing, connection, or HTTP error)
- `504 Gateway Timeout`: Backend timeout (SSE stream timeout or HTTP timeout)

---

## SSE Event Flow

**Backend SSE Stream Example**:
```
event: message
data: {"jsonrpc":"2.0","id":1,"result":{...}}

event: close
data: 

```

**Proxy Processing**:
1. Detect SSE transport (Content-Type or config)
2. Parse SSE stream with eventsource-parser
3. Buffer `event: message` events
4. Extract JSON-RPC from `data:` field
5. Apply filters/transforms to extracted JSON
6. Return JSON-RPC response to client
7. Close SSE connection

---

## Performance Guarantees

- SSE parsing latency: <10ms (p95) on top of existing proxy latency
- SSE connections timeout within ±5% of configured timeout
- Memory bounded: max 10 events buffered per connection

---

## Example Usage

### SSE Backend (Azure APIM)

```bash
# Proxy request to SSE-based MCP server
curl -X POST http://localhost:8080/proxy/azure-apim \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"initialize",
    "params":{
      "protocolVersion":"2024-11-05",
      "capabilities":{},
      "clientInfo":{"name":"test","version":"1.0.0"}
    },
    "id":1
  }'

# Response (extracted from SSE)
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {"tools": {"listChanged": true}},
    "serverInfo": {"name": "Azure API Management", "version": "1.0.0"}
  }
}
```

### HTTP Backend (Existing)

```bash
# Proxy request to HTTP-based MCP server (unchanged)
curl -X POST http://localhost:8080/proxy/http-server \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":2}'

# Response
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {"tools": [...]}
}
```

---

## Implementation Notes

- Proxy buffers entire SSE response before returning to client (Phase 1)
- SSE streaming to client is out of scope for P1 (planned for P3)
- Filter and transform rules apply to extracted JSON-RPC messages
- SSE connections count toward max concurrent connection limit
- Graceful shutdown aborts all active SSE connections
