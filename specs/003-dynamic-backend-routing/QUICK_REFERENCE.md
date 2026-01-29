# Quick Reference: Protocol Handling Implementation Guide

**Purpose**: Quick lookup for implementation team  
**Related**: [protocol-handling-design.md](./protocol-handling-design.md) (comprehensive), [plan.md](./plan.md) (roadmap)

## 5 Rules at a Glance

### Rule 1: Extract Hostname & Port from Header
```
Input: APIM-PROXIED-MCP-HOST header value
Output: {hostname: string, port?: number}

Examples:
  "server.example.com"      → {hostname: "server.example.com", port: undefined}
  "server.example.com:9000" → {hostname: "server.example.com", port: 9000}
  ":9000"                   → ERROR (empty hostname)
  "server:99999"            → ERROR (port out of range)
```

**Implementation Note**: Split on last `:`, validate port is 1-65535, trim whitespace

---

### Rule 2: Determine Port Number
```
Input: {port from Rule 1}, {config.dynamicBackendRouting.defaultPort}
Output: port number (1-65535)

Logic:
  IF header has explicit port → use that
  ELSE IF config has defaultPort → use that
  ELSE use 443 (HTTPS default)

Examples:
  header=9000, defaultPort=8443 → 9000 (explicit wins)
  header=null, defaultPort=8443 → 8443 (config wins)
  header=null, defaultPort=null → 443 (hardcoded default)
```

**Implementation Note**: Three-level precedence lookup (no ambiguity)

---

### Rule 3: Determine Protocol
```
Input: (N/A for MVP)
Output: "https" (always)

Logic (MVP): ALWAYS use HTTPS
  protocol = "https"

Future (Phase 2):
  IF config.allowInsecureProtocol && hostname in insecureAllowlist
    protocol = "http"
  ELSE
    protocol = "https"
```

**Implementation Note**: MVP is simple (always HTTPS). Document future path.

---

### Rule 4: Determine Transport Type
```
Input: {hostname}, {config.backends}, {response headers}
Output: "http" | "sse"

Logic (precedence):
  1. Check static config:
     FOR backend in config.backends
       IF backend.hostname == hostname
         RETURN backend.transport
  2. Auto-detect from response:
     IF response.content-type == "text/event-stream"
       RETURN "sse"
     ELSE
       RETURN "http"
  3. Default:
     RETURN "http"

Examples:
  hostname="mcp-sse.example.com" with config transport="sse" → "sse" (config)
  hostname="unknown.com" with response Content-Type: text/event-stream → "sse" (detect)
  hostname="unknown.com" with response Content-Type: application/json → "http" (default)
```

**Implementation Note**: Transport detection is lazy (only on first request)

---

### Rule 5: Construct Backend URL
```
Input: {protocol, hostname, port, transport}
Output: backend URL string

Logic:
  base_url = protocol + "://" + hostname + ":" + port
  path = (transport == "sse") ? "/sse" : "/mcp"
  RETURN base_url + path

Examples:
  {protocol: "https", hostname: "server.com", port: 443, transport: "http"}
    → "https://server.com:443/mcp"
  {protocol: "https", hostname: "server.com", port: 9000, transport: "sse"}
    → "https://server.com:9000/sse"
```

**Implementation Note**: Straightforward string concatenation

---

## Error Handling Cheat Sheet

| Scenario | Error Code | Status | Action |
|---|---|---|---|
| Missing header | - | 200 | Fall back to static config |
| Empty header | `INVALID_HEADER` | 400 | Return error |
| Invalid port | `INVALID_PORT` | 400 | Return error |
| Hostname not allowlisted | `FORBIDDEN_BACKEND` | 403 | Return error |
| Parse error | `PARSE_ERROR` | 400 | Return error |
| No backend (dynamic + static) | `NO_BACKEND` | 503 | Return error |

**Error Response Format**:
```json
{
  "error": "Invalid APIM-PROXIED-MCP-HOST header",
  "message": "Hostname 'example.com' not in allowlist",
  "code": "FORBIDDEN_BACKEND",
  "status": 403
}
```

**Never expose**: Full backend URLs, allowlist details, internal topology

---

## Configuration Example

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

---

## Validation Rules

### Hostname
- Valid: domain names, wildcards (`*.internal.com`), IP addresses (if enabled)
- Invalid: empty, with spaces, special characters (except `-`, `.`, `*`)

### Port
- Valid: 1-65535
- Invalid: 0, negative, >65535, non-numeric

### Allowlist Matching
```
Exact:    "server.example.com"
Wildcard: "*.internal.example.com" (matches any subdomain)
CIDR:     "192.168.1.0/24" (matches IP range)
```

---

## Performance Targets

| Operation | Target | Optimization |
|---|---|---|
| Header parsing | <0.5ms | Split/parse once |
| Allowlist matching | <1.5ms | Pre-compile regex, use hash for exact matches |
| Total overhead | <2ms | Lazy transport detection, cache results |

**Benchmark Command**:
```javascript
const start = performance.now();
for (let i = 0; i < 10000; i++) {
  parseBackendHostHeader("server.example.com:9000");
  validateAgainstAllowlist("server.example.com", allowlist);
}
console.log(`Average: ${(performance.now() - start) / 10000}ms per request`);
```

---

## Testing Checklist

### Unit Tests (Phase 5-7)
- [ ] Header parsing (valid/invalid formats)
- [ ] Port determination (3-level precedence)
- [ ] Protocol selection (always HTTPS)
- [ ] Transport detection (config > auto-detect > default)
- [ ] URL construction (correct path prefix)

### Integration Tests (Phase 8)
- [ ] End-to-end with valid header
- [ ] End-to-end with HTTP transport
- [ ] End-to-end with SSE transport
- [ ] Fallback to static config (no header)
- [ ] Filter application with dynamic routing

### Security Tests (Phase 9)
- [ ] Allowlist enforcement (blocked host → 403)
- [ ] Deny-by-default (unallowlisted host → 403)
- [ ] Header injection (special chars → 400)
- [ ] URL encoding attacks (percent-encoded injection → 400)

### Performance Tests (Phase 12)
- [ ] Measure <2ms overhead
- [ ] No latency regression for static routes
- [ ] Memory usage stable with 1000 requests

---

## Implementation Tasks

**Phase 1: Foundation** (Days 1-2)
- [ ] T001-T007: Config types, schema, validation
  - Reference: protocol-handling-design.md § Configuration Schema

**Phase 2: Core Logic** (Days 2-3)
- [ ] T008: Rule 1 (header parsing)
- [ ] T009: Rule 2 (port determination)
- [ ] T010: Rule 3 (protocol selection)
- [ ] T011: Rule 4 (transport detection)
- [ ] T012: Rule 5 (URL construction)
  - Reference: protocol-handling-design.md § Rule Set

**Phase 3: Integration** (Days 3)
- [ ] T013-T016: Integrate with request handler, forwarder, logging
  - Reference: plan.md § Phase 2

**Phase 5-8: Testing** (Days 3-4)
- [ ] T028-T060: Unit, integration, security tests
  - Reference: protocol-handling-design.md § Testing Strategy

---

## Future Enhancements (Beyond MVP)

| Enhancement | Phase | Complexity | Value |
|---|---|---|---|
| Explicit protocol in header | Phase 2 | Low | Allow HTTP for internal backends |
| Custom path prefixes | Phase 3 | Low | Support `/api/mcp`, `/v1/mcp`, etc. |
| TLS certificate validation | Phase 4 | Medium | Skip cert validation for internal backends |
| Hostname rewriting | Phase 5 | Medium | Multi-tenant hostname mapping |

---

## Quick Debug Checklist

**Request not routing?**
- [ ] Is `dynamicBackendRouting.enabled` true in config?
- [ ] Does hostname match allowlist pattern?
- [ ] Is header name correct (`APIM-PROXIED-MCP-HOST`)?
- [ ] Check logs for routing decision reason (HEADER vs STATIC_CONFIG vs ERROR)

**Getting 403 Forbidden?**
- [ ] Is hostname in allowlist?
- [ ] Does allowlist pattern match? (check exact vs wildcard)
- [ ] Is `denyByDefault: true`? (if false, empty allowlist allows everything)

**Getting 400 Bad Request?**
- [ ] Is port number 1-65535?
- [ ] Is hostname empty or whitespace-only?
- [ ] Are special characters in hostname escaped correctly?

**Latency too high?**
- [ ] Verify <2ms overhead target met
- [ ] Check allowlist pre-compilation (should be done at config load)
- [ ] Profile header parsing and allowlist matching separately

---

**For complete details**: See [protocol-handling-design.md](./protocol-handling-design.md)  
**For implementation roadmap**: See [plan.md](./plan.md)  
**For user requirements**: See [spec.md](./spec.md)
