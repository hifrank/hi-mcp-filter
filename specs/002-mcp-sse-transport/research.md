# Research: MCP SSE Transport Support

**Phase**: 0 (Outline & Research)  
**Created**: 2026-01-27  
**Purpose**: Resolve technical unknowns and identify best practices for SSE implementation

## Research Tasks

### 1. SSE Parsing Libraries for Node.js

**Decision**: Use **eventsource-parser** for SSE stream parsing

**Rationale**:
- Lightweight library (5KB) specifically designed for SSE parsing
- Works with Node.js streams and fetch Response objects
- Handles multi-line data fields automatically
- Event-based API aligns with SSE specification
- No external dependencies, pure JavaScript

**Alternatives Considered**:
- **Custom implementation**: More control but requires handling edge cases (multi-line data, incomplete events)
- **sse.js**: Browser-focused, not optimized for Node.js server-side use
- **Raw stream parsing**: Complex buffering logic, error-prone for multi-line events

**Implementation Pattern**:
```typescript
import { createParser } from 'eventsource-parser';

const parser = createParser((event) => {
  if (event.type === 'event' && event.event === 'message') {
    const jsonRpcMessage = JSON.parse(event.data);
    // Process message
  }
});

response.body.on('data', (chunk) => parser.feed(chunk.toString()));
```

### 2. SSE Transport Detection

**Decision**: Explicit configuration with auto-detection fallback

**Rationale**:
- Configuration schema includes `transport` field per server: `"http" | "sse" | "auto"`
- Auto-detection checks response `Content-Type: text/event-stream` header
- Default to `"auto"` for new servers (backward compatible)
- Manual override allows forcing transport for edge cases

**Detection Flow**:
1. Check server config for explicit `transport` value
2. If `"auto"`, inspect response `Content-Type` header
3. If `text/event-stream`, use SSE parser
4. Otherwise, use JSON parser

**Configuration Example**:
```json
{
  "mcpServers": [
    {
      "id": "azure-apim",
      "url": "https://hifrankapim.azure-api.net/me/mcp",
      "transport": "sse",
      "timeout": 30000
    },
    {
      "id": "legacy-server",
      "url": "http://localhost:5000",
      "transport": "http"
    }
  ]
}
```

### 3. SSE Event Buffering Strategy

**Decision**: Buffer events until `event: close` or timeout

**Rationale**:
- SSE streams may send multiple events before closing
- MCP typically sends one `event: message` with JSON-RPC response, then `event: close`
- Buffering strategy: collect all `message` events, return first one (MCP single response pattern)
- Timeout enforcement prevents indefinite buffering

**Buffering Logic**:
```typescript
const events: SSEEvent[] = [];
const timeout = setTimeout(() => {
  if (events.length > 0) {
    resolve(events[0].data); // Return first message
  } else {
    reject(new TimeoutError('SSE stream timeout'));
  }
}, serverTimeout);

parser.onEvent = (event) => {
  if (event.event === 'message') {
    events.push(event);
  } else if (event.event === 'close') {
    clearTimeout(timeout);
    resolve(events[0]?.data || null);
  }
};
```

### 4. Multi-line SSE Data Field Handling

**Decision**: Use eventsource-parser built-in multi-line support

**Rationale**:
- SSE spec allows data fields to span multiple lines:
  ```
  data: {"jsonrpc":"2.0",
  data: "id":1,
  data: "result":{...}}
  ```
- eventsource-parser automatically concatenates `data:` lines with `\n`
- JSON.parse handles whitespace, so concatenated data works correctly

**Edge Case Handling**:
- Incomplete JSON across events: Only process complete events (wait for event boundary)
- Invalid JSON in data field: Catch JSON.parse error, log with context, return 502 error

### 5. SSE Connection Lifecycle Management

**Decision**: Abort-based timeout with resource cleanup

**Rationale**:
- Use AbortController for clean connection cancellation
- Timeout triggers abort signal, which cancels fetch request and closes stream
- Graceful shutdown registers abort handlers for all active SSE connections
- Track active connections in WeakMap for automatic cleanup

**Lifecycle Pattern**:
```typescript
class SSEConnectionManager {
  private activeConnections = new Map<string, AbortController>();
  
  async connect(url: string, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const connectionId = crypto.randomUUID();
    this.activeConnections.set(connectionId, controller);
    
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } finally {
      this.activeConnections.delete(connectionId);
    }
  }
  
  abortAll() {
    for (const controller of this.activeConnections.values()) {
      controller.abort();
    }
  }
}
```

### 6. Integration with Existing Filter/Transform Pipeline

**Decision**: SSE parser extracts JSON-RPC, then existing pipeline processes it

**Rationale**:
- SSE is transport layer concern, filter/transform logic operates on JSON-RPC messages
- Forwarder layer handles SSE parsing and returns MCPResponse object
- Filter engine receives extracted JSON-RPC response (same interface as HTTP responses)
- No changes needed to filter/transform engines

**Integration Point**:
```typescript
// In forwarder.ts
async forwardRequest(url: string, request: ForwardRequest, timeout: number, transport?: string) {
  const response = await fetch(url, { method: 'POST', body: JSON.stringify(request) });
  
  if (transport === 'sse' || response.headers.get('content-type')?.includes('text/event-stream')) {
    return await this.parseSSEResponse(response, timeout);
  } else {
    return await response.json();
  }
}

// Filter/transform engines unchanged
```

### 7. Error Handling for Malformed SSE Streams

**Decision**: Fail-fast with detailed error logging

**Rationale**:
- Malformed SSE (invalid event format, incomplete data) should return 502 Bad Gateway
- Log full context: server ID, request ID, partial event data, parse error
- Don't retry SSE errors automatically (likely persistent server issue)
- Client receives JSON-RPC error response with sanitized message

**Error Categories**:
1. **Invalid event format**: Missing `event:` or `data:` prefix → 502 error
2. **Invalid JSON in data**: JSON.parse fails → 502 error with "Invalid JSON-RPC response"
3. **Timeout**: No events received within timeout → 504 Gateway Timeout
4. **Connection error**: Network failure during stream read → 502 Bad Gateway

**Error Response Format**:
```json
{
  "jsonrpc": "2.0",
  "id": "<request_id>",
  "error": {
    "code": -32001,
    "message": "Backend SSE stream error",
    "data": {
      "serverId": "azure-apim",
      "transport": "sse",
      "reason": "Invalid JSON in SSE data field"
    }
  }
}
```

## Resolved Clarifications

| Original Question | Resolution |
|------------------|------------|
| How to parse SSE streams in Node.js? | eventsource-parser library for event-based parsing |
| Should transport be auto-detected or configured? | Both: explicit config with auto-detection fallback via Content-Type header |
| How to handle multi-line SSE data fields? | eventsource-parser handles automatically, concatenates with `\n` |
| What timeout strategy for SSE streams? | AbortController with configured timeout, defaults to server timeout (30s) |
| How to integrate with existing filter pipeline? | SSE parser extracts JSON-RPC, then existing pipeline processes normally |
| How to handle SSE parsing errors? | Fail-fast with 502 error, detailed logging, no automatic retry |
| Should proxy stream SSE to clients? | Phase 1 (P1): No, buffer and return JSON. Phase 2 (P3): Optional streaming mode |

## Technology Stack Summary

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| SSE Parser | eventsource-parser | Lightweight, spec-compliant, handles multi-line data |
| Transport Detection | Response Content-Type header | Standard HTTP header, reliable |
| Timeout Mechanism | AbortController | Native fetch API support, clean cancellation |
| Connection Management | Map + AbortController | Track active connections for graceful shutdown |
| Error Handling | JSON-RPC error responses | Consistent with existing proxy error format |
| Integration | Forwarder layer extension | Minimal changes, preserves filter/transform pipeline |

## Performance Considerations

- **Latency**: SSE parsing adds ~2-5ms overhead (event parsing + JSON extraction)
- **Memory**: Buffer maximum 10 events per stream (prevents memory exhaustion)
- **Concurrency**: SSE connections counted in max concurrent connection limit
- **Streaming**: Phase 1 buffers entire response; Phase 2 (P3) implements true streaming

## Next Phase

Phase 1: Design artifacts (data-model.md, contracts/, quickstart.md)
