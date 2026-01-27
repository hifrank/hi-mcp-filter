# Feature Specification: MCP SSE Transport Support

**Feature Branch**: `002-mcp-sse-transport`  
**Created**: 2026-01-27  
**Status**: Draft  
**Input**: User description: "Add support for proxy to MCP server with protocol streamable HTTP and SSE"

## User Scenarios & Testing

### User Story 1 - Proxy SSE-based MCP Servers (Priority: P1)

Users need to proxy requests to MCP servers that use Server-Sent Events (SSE) transport instead of plain HTTP JSON-RPC. The Azure API Management MCP endpoint uses SSE format where responses are streamed as `event: message` and `data: {...}` lines.

**Why this priority**: Without SSE support, the proxy cannot integrate with Azure APIM MCP endpoints or other SSE-based MCP servers, blocking real-world deployment scenarios.

**Independent Test**: Configure proxy with Azure APIM MCP endpoint (https://hifrankapim.azure-api.net/me/mcp), send `initialize` request, verify proxy extracts JSON-RPC response from SSE stream and returns it to client.

**Acceptance Scenarios**:

1. **Given** proxy configured with SSE-based MCP server, **When** client sends `initialize` request, **Then** proxy parses SSE response and returns JSON-RPC object
2. **Given** SSE server returns multiple events, **When** request is made, **Then** proxy extracts message data and ignores close events
3. **Given** SSE stream includes multiple data lines, **When** parsing response, **Then** proxy concatenates multi-line JSON correctly

---

### User Story 2 - Support Both HTTP and SSE Transports (Priority: P1)

The proxy must support both plain HTTP JSON-RPC and SSE transports in the same deployment, auto-detecting transport type based on server configuration or response headers.

**Why this priority**: Users have heterogeneous MCP server environments with both transport types. Requiring separate proxy instances is operationally complex.

**Independent Test**: Configure proxy with two servers (one HTTP, one SSE), send requests to each, verify both work correctly without manual transport selection.

**Acceptance Scenarios**:

1. **Given** server configured with `transport: "sse"` in config, **When** request is forwarded, **Then** proxy uses SSE parser
2. **Given** server configured with `transport: "http"` or no transport specified, **When** request is forwarded, **Then** proxy uses JSON parser
3. **Given** response has `Content-Type: text/event-stream`, **When** auto-detection enabled, **Then** proxy uses SSE parser

---

### User Story 3 - Handle SSE Streaming and Timeouts (Priority: P2)

SSE responses may stream over time with multiple events. The proxy must handle long-lived connections, timeout appropriately, and clean up resources.

**Why this priority**: SSE connections can hang indefinitely if server doesn't close stream. Proper timeout and cleanup prevents resource exhaustion.

**Independent Test**: Send request to slow SSE server, verify proxy times out after configured duration and returns error to client.

**Acceptance Scenarios**:

1. **Given** SSE stream sends events over 10 seconds, **When** timeout is 30 seconds, **Then** proxy waits for all events before responding
2. **Given** SSE stream doesn't close, **When** timeout is 5 seconds, **Then** proxy closes connection and returns timeout error
3. **Given** SSE connection is established, **When** proxy receives SIGTERM, **Then** proxy closes SSE connections gracefully

---

### User Story 4 - Preserve SSE Format for Streaming Clients (Priority: P3)

Some clients may prefer to receive SSE streams directly instead of converted JSON-RPC. The proxy should support pass-through mode.

**Why this priority**: Advanced use cases like real-time dashboards benefit from native SSE streaming. This is optional for MVP.

**Independent Test**: Configure proxy endpoint with `streaming: true`, send request, verify client receives SSE events in real-time as they arrive.

**Acceptance Scenarios**:

1. **Given** endpoint configured with `streaming: true`, **When** client sends request with `Accept: text/event-stream`, **Then** proxy streams SSE events to client
2. **Given** endpoint configured with `streaming: false`, **When** client requests SSE, **Then** proxy buffers events and returns JSON response

---

### Edge Cases

- **Invalid JSON in SSE data field**: Proxy MUST return 502 Bad Gateway with error logged (covered by FR-010, tested in T024, T029)
- **SSE reconnection events** (`event: error`, `event: retry`): Proxy ignores non-message events per FR-006 (tested in T026)
- **Mixed event types**: Proxy filters events, processing only those in `sseEventFilter` config (default: ["message"]) - covered by FR-006 (tested in T026)
- **Mid-stream connection close**: Proxy returns partial response if close event received, or timeout error if connection drops without close (covered by FR-008, FR-009)
- **Client disconnect during SSE read**: Proxy terminates backend SSE connection and cleans up resources (covered by graceful shutdown in T049-T050)

## Requirements

### Functional Requirements

- **FR-001**: Proxy MUST parse Server-Sent Events (SSE) format responses from backend MCP servers
- **FR-002**: Proxy MUST extract JSON-RPC messages from SSE `data:` fields and return them as plain JSON to clients
- **FR-003**: Proxy MUST support configuring transport type per MCP server (`http`, `sse`, or `auto`)
- **FR-004**: Proxy MUST auto-detect SSE transport when `Content-Type: text/event-stream` is received
- **FR-005**: Proxy MUST handle multi-line SSE data fields by concatenating lines until event boundary
- **FR-006**: Proxy MUST ignore SSE `event: close` and other non-message events
- **FR-007**: Proxy MUST apply existing filter and transformation rules to extracted JSON-RPC responses
- **FR-008**: Proxy MUST timeout SSE connections after configured duration (default 30 seconds)
- **FR-009**: Proxy MUST close SSE connections when receiving SIGTERM during graceful shutdown
- **FR-010**: Proxy MUST log SSE parsing errors and return 502 Bad Gateway to client
- **FR-011**: (Optional P3) Proxy MAY stream SSE events to client when endpoint configured with `streaming: true`

### Key Entities

- **SSEEvent**: Represents a single parsed SSE event with type, event name, data, id, and retry fields
- **MCPServerConfig**: Extended with `transport` field ("http" | "sse" | "auto") and optional `sseOptions`
- **SSEParser**: Component that reads SSE stream and extracts JSON-RPC messages
- **RequestForwarder**: Extended with `forwardSSE` method to handle SSE backend communication alongside existing HTTP forwarding

## Success Criteria

### Measurable Outcomes

- **SC-001**: Proxy successfully forwards requests to Azure APIM SSE MCP endpoint and returns valid JSON-RPC responses
- **SC-002**: Proxy handles both HTTP and SSE transports in single deployment with <10ms additional latency for SSE parsing (measured as per-event parsing overhead, not including network I/O)
- **SC-003**: SSE connections timeout within 5% of configured timeout value (e.g., 30s ± 1.5s)
- **SC-004**: No memory leaks during 1000 sequential SSE requests (memory usage stable within 10MB)
- **SC-005**: 100% of SSE parsing errors are logged with context (event data, line number, server ID)
- **SC-006**: Proxy maintains existing performance targets (<100ms p95 latency) for non-SSE requests

## Scope & Boundaries

**In Scope**:
- Parsing SSE responses from MCP servers
- Converting SSE to JSON-RPC for clients
- Auto-detection and manual configuration of transport type
- Timeout and error handling for SSE streams
- Integration with existing filter/transform pipeline

**Out of Scope**:
- Client-to-proxy SSE streaming (clients always receive JSON-RPC)
- SSE server implementation (proxy is client-side only)
- Bidirectional streaming or WebSocket support
- SSE event ID-based reconnection logic

## Dependencies & Assumptions

**Dependencies**:
- Existing proxy infrastructure (forwarder, config, validation)
- Node.js fetch API or http/https modules for SSE parsing
- SSE parsing library or custom implementation

**Assumptions**:
- SSE servers send well-formed `event:` and `data:` lines per W3C spec
- JSON-RPC messages in SSE `data:` fields are valid and complete
- SSE servers close connections after sending response (or proxy times out)
- Clients are satisfied with JSON-RPC responses (not native SSE streaming)

## Technical Considerations

**SSE Format Example**:
```
event: message
data: {"jsonrpc":"2.0","id":1,"result":{...}}

event: close
data: 

```

**Implementation Notes**:
- Use streaming response parsing to handle large SSE payloads
- Buffer SSE events until `event: close` or timeout
- Extract JSON from `data:` lines (may span multiple lines)
- Preserve request correlation (match request ID to response ID)

**Configuration Schema Addition**:
```json
{
  "mcpServers": [
    {
      "id": "azure-apim",
      "url": "https://hifrankapim.azure-api.net/me/mcp",
      "transport": "sse",
      "timeout": 30000
    }
  ]
}
```

## Security & Privacy

- SSE parsing must not execute code from `data:` fields (JSON.parse only)
- Timeout enforcement prevents resource exhaustion from hanging connections
- SSE connections count toward max concurrent connection limits
- Log sanitization for SSE data (may contain sensitive MCP responses)

## Testing Strategy

**Unit Tests**:
- SSE parser with valid/invalid event streams
- Multi-line data field handling
- Event type filtering (message vs. close vs. error)
- Timeout enforcement

**Integration Tests**:
- End-to-end request through proxy to Azure APIM SSE endpoint
- Mixed HTTP and SSE server configuration
- Graceful shutdown with active SSE connections
- Error handling (malformed SSE, backend timeout)

**Performance Tests**:
- Latency impact of SSE parsing vs. plain HTTP
- Memory usage during long SSE streams
- Concurrent SSE connection handling

## Success Metrics

- Azure APIM MCP integration test passes (initialize + tools/list)
- All existing tests continue to pass (no regression)
- SSE parsing adds <10ms to p95 latency
- Zero memory leaks in 1-hour stress test with SSE requests


### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right edge cases.
-->

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST [specific capability, e.g., "allow users to create accounts"]
- **FR-002**: System MUST [specific capability, e.g., "validate email addresses"]  
- **FR-003**: Users MUST be able to [key interaction, e.g., "reset their password"]
- **FR-004**: System MUST [data requirement, e.g., "persist user preferences"]
- **FR-005**: System MUST [behavior, e.g., "log all security events"]

*Example of marking unclear requirements:*

- **FR-006**: System MUST authenticate users via [NEEDS CLARIFICATION: auth method not specified - email/password, SSO, OAuth?]
- **FR-007**: System MUST retain user data for [NEEDS CLARIFICATION: retention period not specified]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: [Measurable metric, e.g., "Users can complete account creation in under 2 minutes"]
- **SC-002**: [Measurable metric, e.g., "System handles 1000 concurrent users without degradation"]
- **SC-003**: [User satisfaction metric, e.g., "90% of users successfully complete primary task on first attempt"]
- **SC-004**: [Business metric, e.g., "Reduce support tickets related to [X] by 50%"]
