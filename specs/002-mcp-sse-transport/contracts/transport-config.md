# Contract: Transport Configuration API

**Feature**: MCP SSE Transport Support  
**Component**: Configuration Management  
**Version**: 1.0  
**Status**: Draft

---

## Overview

Defines the configuration schema for MCP server transport settings, supporting HTTP, SSE, and auto-detection modes.

---

## Configuration Schema

### MCPServerConfig (Extended)

```typescript
interface MCPServerConfig {
  id: string;                    // Unique server identifier
  url: string;                   // Backend MCP server URL
  transport: TransportType;      // Transport mode (NEW)
  timeout?: number;              // Request timeout (ms, default: 30000)
  sseOptions?: SSETransportConfig; // SSE-specific options (NEW)
  
  // Existing fields (from feature 001)
  headers?: Record<string, string>;
  retries?: number;
  auth?: AuthConfig;
}
```

### TransportType (NEW)

```typescript
type TransportType = 'http' | 'sse' | 'auto';
```

**Values**:
- `'http'`: Force HTTP JSON-RPC transport (POST with JSON body)
- `'sse'`: Force Server-Sent Events transport (POST, expect SSE response)
- `'auto'`: Auto-detect based on response Content-Type header

**Default**: `'auto'`

### SSETransportConfig (NEW)

```typescript
interface SSETransportConfig {
  sseEventFilter?: string[];     // Event types to process (default: ["message"])
  sseBufferSize?: number;        // Max events to buffer (default: 10, max: 1000)
}
```

**Fields**:
- `sseEventFilter`: Array of SSE event types to process. Only events matching these types will be parsed for JSON-RPC messages. Default: `["message"]`.
- `sseBufferSize`: Maximum number of SSE events to buffer before processing. Prevents memory exhaustion on large streams. Min: 1, Max: 1000, Default: 10.

---

## Configuration File Format

### JSON Configuration

```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0",
    "requestTimeout": 30000
  },
  "mcpServers": [
    {
      "id": "azure-apim",
      "url": "https://hifrankapim.azure-api.net/me/mcp",
      "transport": "sse",
      "timeout": 30000,
      "sseOptions": {
        "sseEventFilter": ["message"],
        "sseBufferSize": 10
      }
    },
    {
      "id": "local-http",
      "url": "http://localhost:5000",
      "transport": "http"
    },
    {
      "id": "auto-detect",
      "url": "https://api.example.com/mcp",
      "transport": "auto"
    }
  ],
  "filterRules": [],
  "transformRules": [],
  "plugins": []
}
```

---

## Validation Rules

### Required Fields

- `id`: Non-empty string, unique across all servers
- `url`: Valid HTTP/HTTPS URL
- `transport`: One of `'http'`, `'sse'`, `'auto'`

### Optional Fields

- `timeout`: Integer, 1000 ≤ timeout ≤ 300000 (1s to 5min)
- `sseOptions.sseEventFilter`: Non-empty array of strings
- `sseOptions.sseBufferSize`: Integer, 1 ≤ size ≤ 1000

### Schema Validation

```json
{
  "type": "object",
  "required": ["id", "url"],
  "properties": {
    "id": {"type": "string", "minLength": 1},
    "url": {"type": "string", "format": "uri"},
    "transport": {
      "type": "string",
      "enum": ["http", "sse", "auto"],
      "default": "auto"
    },
    "timeout": {
      "type": "integer",
      "minimum": 1000,
      "maximum": 300000
    },
    "sseOptions": {
      "type": "object",
      "properties": {
        "sseEventFilter": {
          "type": "array",
          "items": {"type": "string"},
          "minItems": 1
        },
        "sseBufferSize": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1000
        }
      }
    }
  }
}
```

---

## Configuration API Endpoints

### GET /config

Returns current configuration including transport settings.

**Response**:
```json
{
  "server": {...},
  "mcpServers": [
    {
      "id": "azure-apim",
      "url": "https://hifrankapim.azure-api.net/me/mcp",
      "transport": "sse",
      "timeout": 30000,
      "sseOptions": {
        "sseEventFilter": ["message"],
        "sseBufferSize": 10
      }
    }
  ],
  "filterRules": [...],
  "transformRules": [...],
  "plugins": [...]
}
```

### PUT /config (Planned - not in Phase 1)

Update configuration dynamically (hot-reload).

**Request**:
```json
{
  "mcpServers": [
    {
      "id": "new-sse-server",
      "url": "https://new.example.com/mcp",
      "transport": "sse"
    }
  ]
}
```

**Response**: `200 OK` with updated config

---

## Transport Detection Logic

### Auto-Detection Flow

When `transport: "auto"`:

1. Send POST request to backend URL
2. Inspect `Content-Type` response header:
   - `text/event-stream` → Use SSE parser
   - `application/json` → Use HTTP JSON parser
   - Other → Return `502 Bad Gateway` (unsupported transport)

### Explicit Transport

When `transport: "sse"` or `"http"`:

1. Skip Content-Type check
2. Use specified parser directly
3. If mismatch (e.g., config says `sse` but backend returns JSON):
   - Log warning
   - Attempt configured parser
   - Return `502 Bad Gateway` on parse failure

---

## Environment Variable Overrides

### Transport Override

```bash
# Force all servers to use SSE
MCP_TRANSPORT_OVERRIDE=sse npm start

# Force all servers to use HTTP
MCP_TRANSPORT_OVERRIDE=http npm start
```

**Behavior**: Overrides `transport` field in config for ALL servers.

### SSE Buffer Size Override

```bash
# Set global SSE buffer size
MCP_SSE_BUFFER_SIZE=50 npm start
```

**Behavior**: Overrides `sseOptions.sseBufferSize` for all SSE servers.

---

## Backward Compatibility

### Default Behavior (No Transport Field)

If `transport` field is missing from config:

```json
{
  "id": "legacy-server",
  "url": "http://localhost:5000"
  // No transport field
}
```

**Behavior**: Defaults to `transport: "auto"`, preserving existing HTTP-only functionality.

### Migration from Feature 001

Existing configs from feature 001 require NO changes:

```json
{
  "mcpServers": [
    {
      "id": "http-server",
      "url": "http://localhost:5000"
    }
  ]
}
```

Auto-detects HTTP transport (backward compatible).

---

## Error Handling

### Invalid Transport Value

**Config**:
```json
{
  "id": "invalid",
  "url": "http://localhost:5000",
  "transport": "websocket"  // Invalid
}
```

**Result**: Configuration validation error on startup:
```
Configuration Error: Invalid transport type "websocket" for server "invalid". Must be one of: http, sse, auto.
```

### Invalid SSE Buffer Size

**Config**:
```json
{
  "sseOptions": {
    "sseBufferSize": 2000  // Exceeds max 1000
  }
}
```

**Result**: Validation error:
```
Configuration Error: sseBufferSize must be between 1 and 1000 (got 2000)
```

### Empty Event Filter

**Config**:
```json
{
  "sseOptions": {
    "sseEventFilter": []  // Empty array
  }
}
```

**Result**: Validation error:
```
Configuration Error: sseEventFilter must contain at least one event type
```

---

## Performance Considerations

### Transport Selection Impact

- **HTTP Transport**: Lower latency (single request-response), higher throughput
- **SSE Transport**: Higher latency (stream parsing), supports streaming responses
- **Auto-Detection**: +1 RTT overhead (initial Content-Type check)

### Buffer Size Guidelines

- **Small buffers (1-10)**: Lower memory, faster processing, suitable for single-message responses
- **Large buffers (100-1000)**: Higher memory, handles multi-message streams, suitable for streaming mode (P3)

**Recommendation**: Use default `sseBufferSize: 10` for Azure APIM (sends 1-2 events per response).

---

## Testing

### Unit Tests

```typescript
describe('MCPServerConfig validation', () => {
  it('accepts valid SSE config', () => {
    const config = {
      id: 'test',
      url: 'http://localhost:5000',
      transport: 'sse',
      sseOptions: {sseEventFilter: ['message'], sseBufferSize: 10}
    };
    expect(validateConfig(config)).toBe(true);
  });
  
  it('rejects invalid transport', () => {
    const config = {id: 'test', url: 'http://localhost:5000', transport: 'ws'};
    expect(() => validateConfig(config)).toThrow('Invalid transport type');
  });
});
```

### Integration Tests

```typescript
describe('Transport configuration', () => {
  it('uses SSE parser when transport=sse', async () => {
    const config = {id: 'test', url: SSE_SERVER_URL, transport: 'sse'};
    const response = await proxy.forward(config, request);
    expect(response.headers['X-Proxy-Transport']).toBe('sse');
  });
  
  it('auto-detects SSE from Content-Type', async () => {
    const config = {id: 'test', url: SSE_SERVER_URL, transport: 'auto'};
    const response = await proxy.forward(config, request);
    expect(response.headers['X-Proxy-Transport']).toBe('sse');
  });
});
```

---

## References

- [Feature 002 Spec](../spec.md)
- [Data Model](../data-model.md)
- [SSE Proxy Endpoint Contract](./sse-proxy-endpoint.md)
