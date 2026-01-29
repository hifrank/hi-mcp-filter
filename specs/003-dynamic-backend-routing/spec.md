# Feature Specification: Dynamic Backend Routing via Request Header

**Feature Branch**: `003-dynamic-backend-routing`  
**Created**: 2026-01-29  
**Status**: Draft  
**Input**: User request: "Add support to set proxy backend target from request header 'APIM-PROXIED-MCP-HOST', enabling APIM to delegate requests to proxy for advanced filtering"

## User Scenarios & Testing

### User Story 1 - APIM Delegates Requests via Header (Priority: P1)

Azure API Management (APIM) needs to delegate MCP requests it cannot process directly to the proxy, which applies advanced filtering rules. Instead of configuring static backend mappings, APIM sends the target MCP server hostname in the `APIM-PROXIED-MCP-HOST` request header, allowing dynamic routing.

**Why this priority**: APIM is the primary API gateway in Azure environments. Without dynamic backend routing, APIM would need to create separate proxy instances for each MCP server, or proxy would require predefined static routing. Dynamic routing enables APIM to use a single proxy instance and delegate selectively.

**Independent Test**: Send request to proxy with `APIM-PROXIED-MCP-HOST: custom-mcp-server.example.com` header, verify proxy routes request to that backend hostname.

**Acceptance Scenarios**:

1. **Given** request includes `APIM-PROXIED-MCP-HOST: server1.example.com`, **When** proxy receives request, **Then** proxy forwards to `https://server1.example.com:443/mcp` instead of configured backend
2. **Given** request does NOT include `APIM-PROXIED-MCP-HOST` header, **When** proxy receives request, **Then** proxy uses standard config-based routing (backward compatible)
3. **Given** `APIM-PROXIED-MCP-HOST` header contains invalid hostname, **When** proxy receives request, **Then** proxy returns 400 Bad Request with validation error
4. **Given** request includes both header and path parameter specifying backend, **When** conflict occurs, **Then** header takes precedence (per FR-011)

---

### User Story 2 - Apply Filters to Dynamically-Routed Requests (Priority: P1)

Requests routed via `APIM-PROXIED-MCP-HOST` header should be subject to the same filtering rules as statically-configured requests. APIM can specify which filters to apply; proxy applies them uniformly regardless of routing source.

**Why this priority**: The whole point of delegating to proxy is to apply advanced filters. Without filter support, dynamic routing is incomplete.

**Independent Test**: Send request with both `APIM-PROXIED-MCP-HOST` header and filter configuration, verify filters are applied to response from dynamically-routed backend.

**Acceptance Scenarios**:

1. **Given** request includes `APIM-PROXIED-MCP-HOST` and filter rules, **When** response is received, **Then** filters are applied to extracted JSON-RPC response
2. **Given** multiple filter chains configured, **When** dynamic routing request arrives, **Then** applicable filters execute in order
3. **Given** filter references static config, **When** dynamic routing used, **Then** filter resolves correctly

---

### User Story 3 - Security: Validate Backend Hostname (Priority: P2)

Dynamic backend routing introduces a potential security risk: APIM could be tricked into proxying to arbitrary backends if header validation is weak. Proxy must validate that the hostname in `APIM-PROXIED-MCP-HOST` is on an allowlist.

**Why this priority**: Security is critical for production. Without hostname validation, the proxy becomes an open redirector. APIM operators must be able to specify which backends are allowed to be dynamically routed.

**Independent Test**: Configure allowlist of permitted backends, send request with disallowed hostname in header, verify proxy rejects with 403 Forbidden.
---

### Edge Cases

- **Empty header value**: `APIM-PROXIED-MCP-HOST: ""` - Proxy ignores header and uses config-based routing
- **Hostname with port**: `APIM-PROXIED-MCP-HOST: server.example.com:9000` - Proxy respects explicit port
- **Header with whitespace**: `APIM-PROXIED-MCP-HOST: " server.example.com "` - Proxy trims whitespace
- **IP address instead of hostname**: `APIM-PROXIED-MCP-HOST: 192.168.1.100` - Allowed if validation permits
- **Request without target server config**: If no static config AND no header - Proxy returns 400
- **Header present but allowlist blocks all dynamic routing**: Proxy respects allowlist and denies

## Requirements

### Functional Requirements

- **FR-001**: Proxy MUST read `APIM-PROXIED-MCP-HOST` request header and use as backend hostname if present
- **FR-002**: Proxy MUST maintain backward compatibility: if header absent, use standard config-based routing
- **FR-003**: Proxy MUST validate hostname format (valid DNS name or IP address)
- **FR-004**: Proxy MUST enforce allowlist of permitted backends for dynamic routing (security gate)
- **FR-005**: Proxy MUST apply configured filters to responses from dynamically-routed backends
- **FR-006**: Proxy MUST construct correct backend URL from hostname (protocol, port, path defaults)
- **FR-007**: Proxy MUST log which backend was selected (static config vs. dynamic header) for observability
- **FR-008**: Proxy MUST return 400 Bad Request if header contains invalid/unparseable hostname
- **FR-009**: Proxy MUST return 403 Forbidden if header hostname is not on allowlist
- **FR-010**: Proxy MUST handle dynamic routing for both HTTP and SSE backends (transport-agnostic)
- **FR-011**: When header specifies backend, it overrides configured backend (header precedence rule)

### Key Entities

- **DynamicBackendConfig**: Configuration for dynamic routing (allowlist, default behavior, header name)
- **BackendSelection**: Enum indicating routing source (STATIC_CONFIG, HEADER, ERROR)
- **RoutingDecision**: Object containing selected backend, selection source, and validation status

## Success Criteria

### Measurable Outcomes

- **SC-001**: Proxy successfully routes requests with valid `APIM-PROXIED-MCP-HOST` header to specified backend
- **SC-002**: Allowlist validation prevents routing to non-allowlisted backends (403 responses)
- **SC-003**: Backward compatibility maintained: requests without header route to configured backend (zero latency overhead)
- **SC-004**: Filters applied to dynamically-routed responses match behavior of static-route responses
- **SC-005**: Header validation overhead <2ms per request (hostname parsing, allowlist check)
- **SC-006**: Logging includes backend selection reason (STATIC_CONFIG, HEADER, or ERROR) in 100% of requests
- **SC-007**: All existing tests continue to pass (zero regression)

## Technical Considerations

### Protocol & Port Selection

When routing via `APIM-PROXIED-MCP-HOST` header, the proxy determines the backend URL as follows:

**Step 1: Extract hostname and port from header**
```
APIM-PROXIED-MCP-HOST: server.example.com
  → hostname = "server.example.com", port = null

APIM-PROXIED-MCP-HOST: server.example.com:9000
  → hostname = "server.example.com", port = 9000
```

**Step 2: Determine protocol (secure-by-default)**
- ALWAYS use HTTPS
- Future enhancement: Allow config flag `allowInsecureProtocol` for internal-only backends requiring HTTP

**Step 3: Determine port (precedence order)**
1. If port specified in header → use that port
2. Else if `dynamicBackendRouting.defaultPort` configured → use that (default: 443)
3. Else use port 443 (default HTTPS port)

**Step 4: Determine transport type (HTTP vs SSE)**
1. If dynamically-routed hostname has static config entry → use configured transport
2. Else auto-detect from response `Content-Type: text/event-stream` header
3. If auto-detection fails → default to HTTP

**Step 5: Construct backend URL**
- Base: `https://{hostname}:{port}`
- Path: `/mcp` for HTTP transport, `/sse` for SSE transport (same as static routing)
- Example: `https://server.example.com:9000/mcp`

### Examples

| Header Value | Parsed Result | Final URL |
|---|---|---|
| `server.example.com` | hostname=server.example.com, port=null | `https://server.example.com:443/mcp` |
| `server.example.com:9000` | hostname=server.example.com, port=9000 | `https://server.example.com:9000/mcp` |
| `internal-mcp:8080` | hostname=internal-mcp, port=8080 | `https://internal-mcp:8080/mcp` |
| `mcp-sse.example.com` (SSE configured) | hostname=mcp-sse.example.com, port=null | `https://mcp-sse.example.com:443/sse` |

### Future Enhancement Path

For MVP (Phase 1), protocol is always HTTPS. Future enhancements:
- Allow explicit protocol in header: `APIM-PROXIED-MCP-HOST: server.example.com:http:8080`
- Allow per-backend protocol override in config: `"allowInsecureProtocol": true` for specific backends
- Support custom path prefixes per backend

### Configuration Schema

```json
{
  "dynamicBackendRouting": {
    "enabled": true,
    "headerName": "APIM-PROXIED-MCP-HOST",
    "allowlist": [
      "*.internal.example.com",
      "mcp-server-1.example.com",
      "192.168.1.100"
    ],
    "denyByDefault": true,
    "defaultPort": 443,
    "allowIpAddresses": false,
    "allowInsecureProtocol": false
  }
}
```
