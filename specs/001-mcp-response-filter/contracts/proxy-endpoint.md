# Contract: Proxy Endpoint

**Endpoint**: `POST /proxy/:serverId`  
**Purpose**: Forward MCP requests to backend servers and filter/transform responses  
**Priority**: P1 (User Stories 1, 2), P2 (User Stories 3, 4)

## Request

```http
POST /proxy/mcp-server-1 HTTP/1.1
Host: proxy:8080
Content-Type: application/json
X-Request-ID: abc-123-def
X-User-ID: user@example.com

{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "file_reader",
    "arguments": {"path": "/data/file.txt"}
  },
  "id": "req-001"
}
```

**Path Parameters**:
- `serverId`: string (backend MCP server identifier from config)

**Headers**:
- `Content-Type`: `application/json` (required)
- `X-Request-ID`: string (optional, for request tracing)
- `X-User-ID`: string (optional, for user-specific filtering/plugins)
- Any other headers are forwarded to backend MCP server

**Body**: MCP JSON-RPC 2.0 request (validated against schema)

---

## Response

### Success (200 OK - Response Allowed)

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Proxy-Filtered: false
X-Proxy-Transformed: true
X-Proxy-Latency-Ms: 45

{
  "jsonrpc": "2.0",
  "result": {
    "content": [
      {"type": "text", "text": "File contents here"}
    ],
    "isError": false
  },
  "id": "req-001"
}
```

**Response Headers**:
- `X-Proxy-Filtered`: boolean (true if any filter rules evaluated)
- `X-Proxy-Transformed`: boolean (true if transformations applied)
- `X-Proxy-Latency-Ms`: number (proxy processing time excluding backend call)

**Body**: MCP JSON-RPC 2.0 response (potentially transformed)

---

### Filtered Response (403 Forbidden)

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json
X-Proxy-Filter-Matched: filter-001

{
  "error": {
    "code": -32000,
    "message": "Response blocked by proxy filter",
    "data": {
      "filterId": "filter-001",
      "filterName": "Block dangerous tools",
      "reason": "Tool 'dangerous_tool' not allowed"
    }
  },
  "jsonrpc": "2.0",
  "id": "req-001"
}
```

Returned when filter rules drop the response.

---

### Backend Error (502 Bad Gateway)

```http
HTTP/1.1 502 Bad Gateway
Content-Type: application/json

{
  "error": {
    "code": -32001,
    "message": "Backend MCP server error",
    "data": {
      "serverId": "mcp-server-1",
      "reason": "Connection timeout after 5000ms"
    }
  },
  "jsonrpc": "2.0",
  "id": "req-001"
}
```

Returned when backend MCP server is unreachable or returns error.

---

### Validation Error (400 Bad Request)

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": {
    "code": -32600,
    "message": "Invalid MCP request",
    "data": {
      "validationErrors": [
        "Missing required field: jsonrpc",
        "Field 'id' must be string or number"
      ]
    }
  },
  "jsonrpc": "2.0",
  "id": null
}
```

Returned when request does not conform to MCP JSON-RPC 2.0 schema.

---

### Plugin Error (500 Internal Server Error)

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": {
    "code": -32603,
    "message": "Plugin execution error",
    "data": {
      "pluginName": "rate-limiter",
      "reason": "Plugin timeout after 5000ms"
    }
  },
  "jsonrpc": "2.0",
  "id": "req-001"
}
```

Returned when custom plugin fails and error behavior is "fail-secure".

---

## Status Codes

- `200 OK`: Request successfully processed and response allowed
- `400 Bad Request`: Invalid MCP request format
- `403 Forbidden`: Response blocked by filter rules or plugins
- `404 Not Found`: Specified `serverId` not configured
- `500 Internal Server Error`: Proxy internal error (plugin failure, transformation error)
- `502 Bad Gateway`: Backend MCP server unreachable or returned error
- `503 Service Unavailable`: Proxy overloaded or shutting down
- `504 Gateway Timeout`: Backend MCP server response timeout

---

## Performance Guarantees

- Proxy latency: <100ms (p95) excluding backend call time
- Filter evaluation: <10ms (p95)
- Transformation: <10ms per rule (p95)
- Plugin execution: <5000ms (configurable timeout)

---

## Error Handling

- Invalid requests fail fast with 400 (no backend call)
- Backend errors logged and returned as 502
- Filter drops logged with matched filter details
- Plugin errors depend on configured error behavior:
  - `fail-open`: Log error, allow response
  - `fail-secure`: Return 500, block response
  - `retry`: Retry up to `retryAttempts`, then fail-secure

---

## Example Usage

```bash
# Proxy MCP request to backend server
curl -X POST http://localhost:8080/proxy/mcp-server-1 \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: test-001" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {"name": "calculator", "arguments": {"op": "add", "a": 1, "b": 2}},
    "id": "calc-001"
  }'

# Response (transformed)
{
  "jsonrpc": "2.0",
  "result": {"value": 3},
  "id": "calc-001"
}
```
