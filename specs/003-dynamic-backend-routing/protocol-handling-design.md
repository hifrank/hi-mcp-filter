# Technical Design: Protocol & Port Selection

**Document**: Protocol handling rules for dynamic backend routing  
**Date**: 2026-01-29  
**Status**: Design (Phase 1)  
**Related**: [spec.md](./spec.md) (Technical Considerations section), [plan.md](./plan.md)

## Overview

When routing requests via the `APIM-PROXIED-MCP-HOST` header, the proxy must determine:
1. **Hostname**: Which server to connect to
2. **Port**: Which port number to use (with fallback rules)
3. **Protocol**: HTTP or HTTPS (secure-by-default)
4. **Transport**: HTTP or SSE (auto-detected or configured)
5. **Path**: Endpoint path for the backend

This document specifies the exact rules and precedence order.

## Terminology

- **Hostname**: Domain name or IP address (e.g., `server.example.com`, `192.168.1.100`)
- **Port**: TCP port number (1-65535)
- **Protocol**: Network layer protocol (HTTP or HTTPS)
- **Transport**: Application layer transport (HTTP or Server-Sent Events)
- **Header Value**: Content of `APIM-PROXIED-MCP-HOST` request header

## Rule Set

### Rule 1: Extract Hostname & Port from Header

**Input**: `APIM-PROXIED-MCP-HOST` header value

**Algorithm**:
```
IF header_value contains ':' (last occurrence)
  hostname = substring before last ':'
  port_str = substring after last ':'
  IF port_str is valid number between 1-65535
    port = parse(port_str)
  ELSE
    raise ValidationError("Invalid port in header: {port_str}")
ELSE
  hostname = entire header_value
  port = null

hostname = trim(hostname)
IF hostname is empty
  raise ValidationError("Empty hostname in header")

RETURN {hostname, port}
```

**Examples**:
```
"server.example.com" → {hostname: "server.example.com", port: null}
"server.example.com:9000" → {hostname: "server.example.com", port: 9000}
"server.example.com:443" → {hostname: "server.example.com", port: 443}
"server.example.com:65535" → {hostname: "server.example.com", port: 65535}
"server.example.com:0" → ValidationError (port must be 1-65535)
"server.example.com:66000" → ValidationError (port out of range)
"server.example.com:" → ValidationError (port empty)
"" → ValidationError (empty hostname)
" server.example.com " → {hostname: "server.example.com", port: null}
```

**Implementation Note**: Use regex pattern:
```
^([a-zA-Z0-9.-]+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::(\d+))?$
```

### Rule 2: Determine Port Number

**Inputs**: `port` from Rule 1, `config.dynamicBackendRouting.defaultPort`

**Algorithm**:
```
IF port is specified in header (not null)
  RETURN port

ELSE IF config.dynamicBackendRouting.defaultPort is set
  RETURN config.dynamicBackendRouting.defaultPort

ELSE
  RETURN 443  # HTTPS default
```

**Examples** (with defaultPort = 8443):
```
Header "server.example.com:9000" → port = 9000 (explicit)
Header "server.example.com", defaultPort=8443 → port = 8443 (config)
Header "server.example.com", defaultPort=undefined → port = 443 (hardcoded default)
```

**Rationale**: 
- Explicit port in header takes precedence (user intent)
- Config default allows operators to override global HTTPS port (e.g., internal TLS on 8443)
- Fallback to 443 ensures HTTPS is always used (secure-by-default)

### Rule 3: Determine Protocol (Secure-by-Default)

**Algorithm** (MVP implementation):
```
ALWAYS use HTTPS protocol
protocol = "https"
```

**Future Enhancement** (Phase 2):
```
IF config.dynamicBackendRouting.allowInsecureProtocol is true
  AND hostname matches insecure allowlist
  THEN protocol = "http"
ELSE
  protocol = "https"
```

**Rationale**: 
- MVP enforces HTTPS-only for security (no man-in-the-middle attacks)
- Future versions allow opt-in insecure protocol for internal-only backends
- Never expose insecure protocol as a default

### Rule 4: Determine Transport Type (HTTP vs SSE)

**Inputs**: 
- `hostname` from Rule 1
- `config.backends` (static configuration)
- Response `Content-Type` header from first request

**Algorithm**:
```
Step 1: Check static config
  FOR EACH backend in config.backends
    IF backend.hostname == hostname AND backend.transport is defined
      RETURN backend.transport  # Use configured transport

Step 2: Auto-detect from response
  IF response.headers['content-type'] contains 'text/event-stream'
    RETURN 'sse'
  ELSE IF response.headers['content-type'] contains 'application/json'
    RETURN 'http'
  ELSE IF response.status is 200
    RETURN 'http'  # Default to HTTP for successful responses
  ELSE
    RETURN 'http'  # Default to HTTP for error responses

Step 3: Default
  RETURN 'http'
```

**Examples**:
```
hostname "mcp-sse.example.com" with static config transport="sse" → "sse"
hostname "mcp.example.com" with response Content-Type: text/event-stream → "sse"
hostname "unknown.example.com" with Content-Type: application/json → "http"
hostname "unknown.example.com" with no Content-Type header → "http" (default)
```

**Rationale**:
- Static config takes precedence (operator knows the backend)
- Auto-detection from response handles unknown backends
- Default to HTTP is safest (HTTP tools work everywhere, SSE is optional)

### Rule 5: Construct Backend URL

**Inputs**: 
- `protocol` from Rule 3
- `hostname` from Rule 1
- `port` from Rule 2
- `transport` from Rule 4

**Algorithm**:
```
base_url = protocol + "://" + hostname + ":" + port

IF transport == "sse"
  path = "/sse"
ELSE  # transport == "http"
  path = "/mcp"

backend_url = base_url + path

RETURN backend_url
```

**Examples**:
```
{protocol: "https", hostname: "server.example.com", port: 443, transport: "http"}
→ "https://server.example.com:443/mcp"

{protocol: "https", hostname: "server.example.com", port: 9000, transport: "sse"}
→ "https://server.example.com:9000/sse"

{protocol: "https", hostname: "internal-mcp", port: 8443, transport: "http"}
→ "https://internal-mcp:8443/mcp"
```

## Configuration Schema

```json
{
  "dynamicBackendRouting": {
    "enabled": true,
    "headerName": "APIM-PROXIED-MCP-HOST",
    "allowlist": [
      "*.internal.example.com",
      "mcp-server-1.example.com",
      "mcp-server-2.example.com",
      "192.168.1.100",
      "192.168.1.0/24"
    ],
    "denyByDefault": true,
    "defaultPort": 443,
    "allowIpAddresses": false,
    "allowInsecureProtocol": false
  }
}
```

**Field Definitions**:
- `enabled`: (boolean) Enable/disable dynamic routing feature
- `headerName`: (string) HTTP header name to read (default: "APIM-PROXIED-MCP-HOST")
- `allowlist`: (string[]) List of allowed hostnames (wildcards supported)
- `denyByDefault`: (boolean) If true, deny any hostname not in allowlist
- `defaultPort`: (number) Port to use if not specified in header (default: 443)
- `allowIpAddresses`: (boolean) If true, allow IP addresses in allowlist (default: false)
- `allowInsecureProtocol`: (boolean) If true, allow HTTP for approved backends (default: false)

## Validation Rules

### Hostname Validation

**Valid hostnames**:
- Domain names: `server.example.com`, `mcp.internal`, `*.wildcard.com`
- Internationalized domains: `例え.jp` (if supported by Node.js)
- IP addresses: `192.168.1.100` (if `allowIpAddresses: true`)
- CIDR ranges: `192.168.1.0/24` (if `allowIpAddresses: true`)

**Invalid hostnames**:
- Empty string
- Hostnames with spaces
- Hostnames with port numbers (port should be in Rule 1)
- Special characters except `-`, `.`, `*`

### Port Validation

**Valid ports**: 1-65535

**Invalid ports**: 0, negative numbers, >65535, non-numeric

**Reserved ports to consider**:
- Ports 1-1023: Require elevated privileges, typically avoided
- Port 80: HTTP (but protocol is always HTTPS in MVP)
- Port 443: HTTPS (default)

### Allowlist Matching

**Exact match**:
```
Allowlist: ["server.example.com"]
Request header "server.example.com" → MATCH
Request header "other.example.com" → NO MATCH
```

**Wildcard match** (supports `*` at start only):
```
Allowlist: ["*.internal.example.com"]
Request header "mcp.internal.example.com" → MATCH
Request header "mcp-1.internal.example.com" → MATCH
Request header "internal.example.com" → MATCH
Request header "external.example.com" → NO MATCH
```

**CIDR match** (if enabled):
```
Allowlist: ["192.168.1.0/24"]
Request header "192.168.1.100" → MATCH
Request header "192.168.1.255" → MATCH
Request header "192.168.2.100" → NO MATCH
```

## Error Handling

### Validation Errors

| Scenario | Error Code | Status | Reason |
|---|---|---|---|
| Missing header | None | 200 OK | Fall back to static config |
| Empty header value | 400 | Bad Request | Invalid input |
| Invalid port number | 400 | Bad Request | Port out of range |
| Hostname not in allowlist | 403 | Forbidden | Security: deny-by-default |
| Hostname parse error | 400 | Bad Request | Malformed header |
| No backend available | 503 | Service Unavailable | Static config also absent |

### Error Response Format

```json
{
  "error": "Invalid APIM-PROXIED-MCP-HOST header",
  "message": "Hostname 'unknown.example.com' not in allowlist",
  "code": "ROUTING_ERROR",
  "status": 403
}
```

**Important**: Never expose:
- Full backend URLs in error messages
- Allowlist details in error responses
- Internal network topology

## Performance Considerations

### Target Metrics

- **Header parsing**: <0.5ms
- **Allowlist matching**: <1.5ms per request
- **Total overhead**: <2ms per request

### Optimization Strategies

1. **Pre-compile allowlist patterns** (during config load):
   - Convert glob patterns to regex once
   - Cache compiled patterns

2. **Use efficient hostname matching**:
   - For exact matches: O(1) hash lookup
   - For wildcard patterns: O(n) regex match on patterns only

3. **Lazy transport detection**:
   - Don't detect transport until first request to backend
   - Cache transport type per backend

### Benchmarking

Create performance test that measures:
```javascript
// Measure header parsing
const start = performance.now();
for (let i = 0; i < 10000; i++) {
  parseBackendHostHeader("server.example.com:9000");
}
const elapsed = performance.now() - start;
console.log(`Header parsing: ${elapsed / 10000}ms per request`);

// Measure allowlist matching
const allowlist = ["*.internal.example.com", "server-1.example.com"];
const start2 = performance.now();
for (let i = 0; i < 10000; i++) {
  validateAgainstAllowlist("mcp.internal.example.com", allowlist);
}
const elapsed2 = performance.now() - start2;
console.log(`Allowlist matching: ${elapsed2 / 10000}ms per request`);
```

## Future Enhancements

### Phase 2: Explicit Protocol Support

Allow users to specify protocol in header or config:

```
APIM-PROXIED-MCP-HOST: server.example.com:http:8080
```

Decoding:
1. If format matches `{hostname}:{protocol}:{port}` → explicit protocol
2. Else if format matches `{hostname}:{port}` → use HTTPS (current behavior)
3. Else `{hostname}` → use HTTPS (current behavior)

### Phase 3: Custom Path Prefixes

Allow per-backend custom paths instead of hardcoded `/mcp` and `/sse`:

```json
{
  "backends": [
    {
      "hostname": "custom-backend.example.com",
      "path": "/api/mcp",
      "transport": "http"
    }
  ]
}
```

### Phase 4: TLS Certificate Validation

- Skip certificate validation for internal backends (configurable)
- Support custom CA certificates per backend
- Support mTLS (mutual TLS) with client certificates

### Phase 5: Hostname Rewriting

Allow rewriting hostnames for multi-tenant scenarios:

```json
{
  "hostnameMappings": {
    "tenant-1": "backend-tenant-1.internal.example.com",
    "tenant-2": "backend-tenant-2.internal.example.com"
  }
}
```

## Testing Strategy

### Unit Tests

1. **Header parsing**: Valid/invalid formats, edge cases
2. **Port determination**: Precedence rules (explicit > config > default)
3. **Protocol determination**: Always HTTPS (MVP)
4. **Transport determination**: Config > auto-detect > default
5. **URL construction**: Correct formatting

### Integration Tests

1. **End-to-end routing**: Request with valid header routes correctly
2. **Transport handling**: Both HTTP and SSE work
3. **Error cases**: Invalid header, blocked hostname, missing backend
4. **Performance**: Overhead <2ms verified

### Security Tests

1. **Allowlist enforcement**: Invalid hosts return 403
2. **Header injection**: Special characters rejected
3. **URL encoding attacks**: Percent-encoded injection blocked

### Examples

Test cases for Rule 2 (Port Determination):

```javascript
describe('Port Determination', () => {
  it('uses explicit port from header', () => {
    const result = determinePort({port: 9000}, {defaultPort: 8443});
    expect(result).toBe(9000);
  });

  it('uses config default port when header has no port', () => {
    const result = determinePort({port: null}, {defaultPort: 8443});
    expect(result).toBe(8443);
  });

  it('uses 443 when no explicit port or config default', () => {
    const result = determinePort({port: null}, {});
    expect(result).toBe(443);
  });
});
```

## Summary

This design ensures:
- ✅ Secure-by-default (HTTPS always, deny-by-default allowlist)
- ✅ Flexible port configuration (explicit > config > default)
- ✅ Transport agnostic (auto-detects HTTP vs SSE)
- ✅ Backward compatible (header optional, falls back to static config)
- ✅ High performance (<2ms overhead target)
- ✅ Clear validation rules (all error cases defined)
- ✅ Future-extensible (clear path for protocol, paths, certificates)
