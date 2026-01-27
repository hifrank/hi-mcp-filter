# Data Model: MCP SSE Transport Support

**Feature**: MCP SSE Transport Support  
**Created**: 2026-01-27  
**Purpose**: Define entities for SSE transport integration

## Core Entities

### 1. SSEEvent

Represents a single parsed Server-Sent Event from an SSE stream.

**Fields**:
- `type`: string ("event" | "comment" | "id" | "retry")
- `event`: string (event type name, e.g., "message", "close", "error")
- `data`: string (event data, may be multi-line JSON)
- `id`: string (optional event ID for reconnection)
- `retry`: number (optional reconnection retry interval in ms)

**Validation Rules**:
- `type` determines how event is processed (only "event" type has data)
- `event` field defaults to "message" if not specified
- `data` field is concatenated from multiple `data:` lines with `\n`
- `id` and `retry` are optional per SSE spec

**Example**:
```typescript
{
  type: "event",
  event: "message",
  data: '{"jsonrpc":"2.0","id":1,"result":{...}}',
  id: "event-123",
  retry: null
}
```

---

### 2. SSETransportConfig

Configuration for SSE transport behavior per MCP server.

**Fields**:
- `transport`: enum ("http", "sse", "auto")
- `sseEventFilter`: array of strings (event types to process, default: ["message"])
- `sseBufferSize`: number (max events to buffer, default: 10)
- `sseStreamingMode`: boolean (P3: stream to client vs. buffer, default: false)

**Validation Rules**:
- `transport` determines parsing strategy
- `"auto"` uses Content-Type header detection
- `sseEventFilter` must include at least one event type
- `sseBufferSize` must be > 0 and < 1000

**Example**:
```typescript
{
  transport: "sse",
  sseEventFilter: ["message"],
  sseBufferSize: 10,
  sseStreamingMode: false
}
```

---

### 3. MCPServerConfig (Extended)

Existing entity extended with SSE transport fields.

**New Fields**:
- `transport`: enum ("http" | "sse" | "auto", default: "auto")
- `sseOptions`: SSETransportConfig (optional, defaults applied if omitted)

**Validation Rules**:
- `transport` field is optional (defaults to "auto")
- `sseOptions` only applied when `transport` is "sse" or auto-detected as SSE
- Backward compatible: existing configs without `transport` field use auto-detection

**Example**:
```json
{
  "id": "azure-apim",
  "url": "https://hifrankapim.azure-api.net/me/mcp",
  "timeout": 30000,
  "transport": "sse",
  "sseOptions": {
    "sseEventFilter": ["message"],
    "sseBufferSize": 10
  }
}
```

---

### 4. SSEParser

Component responsible for parsing SSE streams into SSEEvent objects.

**Methods**:
- `parse(stream: ReadableStream<Uint8Array>): AsyncIterator<SSEEvent>`
- `parseToCompletion(stream: ReadableStream, timeout: number): Promise<SSEEvent[]>`
- `extractJsonRpc(events: SSEEvent[]): MCPResponse`

**State**:
- `eventBuffer`: SSEEvent[] (buffered events)
- `partialEvent`: string (incomplete event data between chunks)
- `parseState`: enum ("IDLE", "READING_EVENT", "READING_DATA")

**Lifecycle**:
Created per request → Parses stream → Extracts JSON-RPC → Disposed

---

### 5. SSEConnection

Represents an active SSE connection to backend MCP server.

**Fields**:
- `connectionId`: string (unique identifier)
- `serverId`: string (MCP server ID from config)
- `requestId`: string | number (JSON-RPC request ID)
- `abortController`: AbortController (for timeout/cancellation)
- `startTime`: number (connection start timestamp)
- `eventsReceived`: number (count of events)
- `state`: enum ("CONNECTING", "OPEN", "CLOSING", "CLOSED", "ERROR")

**Lifecycle**:
Created → Connecting → Open → (events stream) → Closing → Closed

**Cleanup**:
- AbortController abort() called on timeout or error
- Connection removed from active connections map
- Resources released (stream readers, timers)

---

## Entity Relationships

```
MCPServerConfig
  ├─ has 0..1 → SSETransportConfig
  └─ creates → SSEConnection (per request)

SSEConnection
  ├─ uses → SSEParser (1:1)
  ├─ produces → SSEEvent[] (0..n)
  └─ managed by → SSEConnectionManager

SSEParser
  ├─ consumes → ReadableStream<Uint8Array>
  ├─ emits → SSEEvent[] (0..n)
  └─ extracts → MCPResponse (1)

SSEEvent
  └─ contains → JSON-RPC message (in data field)

MCPResponse
  └─ processed by → Filter/Transform Pipeline (unchanged)
```

## State Management

### SSE Connection Lifecycle

1. **CONNECTING**: fetch() initiated, awaiting response
2. **OPEN**: Headers received, stream readable, parsing events
3. **CLOSING**: Stream ended or timeout triggered, finalizing
4. **CLOSED**: Connection fully closed, events extracted
5. **ERROR**: Parse error, network error, or timeout

### SSE Parsing State Machine

```
IDLE
  ↓ (chunk received)
READING_EVENT
  ↓ (event: line)
  └─ store event type
  ↓ (data: line)
READING_DATA
  ↓ (more data: lines)
  └─ accumulate data
  ↓ (blank line)
EMIT_EVENT
  ↓ (event complete)
IDLE
```

## Data Flow

```
[Client Request]
    ↓
[Proxy Route Handler]
    ↓
[RequestForwarder.forwardRequest()]
    ↓ (check transport type)
    ├─ HTTP → JSON parser
    └─ SSE → SSEParser
        ↓
    [SSEConnectionManager.connect()]
        ↓
    [fetch() with AbortController]
        ↓
    [Response stream]
        ↓
    [SSEParser.parse()]
        ↓
    [SSEEvent[] buffer]
        ↓
    [extractJsonRpc()]
        ↓
    [MCPResponse]
        ↓
[Filter/Transform Pipeline]
    ↓
[Client Response]
```

## Configuration Schema Updates

### config/schema.json

Add transport fields to mcpServers schema:

```json
{
  "mcpServers": {
    "type": "array",
    "items": {
      "type": "object",
      "required": ["id", "url"],
      "properties": {
        "id": { "type": "string" },
        "url": { "type": "string", "format": "uri" },
        "timeout": { "type": "integer", "minimum": 1000, "default": 30000 },
        "transport": {
          "type": "string",
          "enum": ["http", "sse", "auto"],
          "default": "auto",
          "description": "Transport protocol: http (JSON-RPC), sse (Server-Sent Events), or auto-detect"
        },
        "sseOptions": {
          "type": "object",
          "properties": {
            "sseEventFilter": {
              "type": "array",
              "items": { "type": "string" },
              "default": ["message"],
              "description": "SSE event types to process"
            },
            "sseBufferSize": {
              "type": "integer",
              "minimum": 1,
              "maximum": 1000,
              "default": 10,
              "description": "Maximum events to buffer"
            },
            "sseStreamingMode": {
              "type": "boolean",
              "default": false,
              "description": "Stream SSE events to client (P3 feature)"
            }
          }
        }
      }
    }
  }
}
```

## Performance Considerations

- **Memory**: SSE event buffer limited to 10 events (configurable, max 1000)
- **Latency**: SSE parsing adds ~2-5ms overhead per request
- **Concurrency**: SSE connections tracked in Map, bounded by max concurrent connections
- **Timeout**: AbortController ensures connections don't leak on timeout

---

## Next Phase

Phase 1 (continued): API contracts (contracts/) and quickstart guide (quickstart.md)
