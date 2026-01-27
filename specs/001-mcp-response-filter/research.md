# Research: MCP Response Filter Proxy

**Phase**: 0 (Outline & Research)  
**Created**: 2026-01-27  
**Purpose**: Resolve all NEEDS CLARIFICATION items from Technical Context and identify best practices for implementation

## Research Tasks

### 1. Node.js HTTP Proxy Architecture

**Decision**: Use **Fastify** as the HTTP server framework

**Rationale**:
- Performance-focused (handles 30k+ req/s with low overhead, faster than Express)
- Built-in async/await support (critical for proxy middleware pipeline)
- Schema-based validation (aligns with MCP protocol validation needs)
- Lightweight plugin system (useful for extending proxy functionality)
- Excellent TypeScript support

**Alternatives Considered**:
- **Express.js**: More mature ecosystem, but slower performance and callback-heavy patterns complicate async proxy logic
- **Native http/https modules**: Maximum control but requires building middleware system from scratch
- **http-proxy-middleware**: Good for simple proxying but lacks flexibility for complex filter/transform logic

**Implementation Pattern**: Fastify with custom middleware hooks for request/response interception and transformation

### 2. MCP Protocol Specification

**Decision**: Implement MCP JSON-RPC 2.0 validation with schema-based approach

**Rationale**:
- MCP is built on JSON-RPC 2.0 specification
- Responses follow structured format: `{jsonrpc: "2.0", result: {...}, id: string}`
- Protocol validation is critical (Principle IV: MCP Protocol Compliance)
- Use `ajv` (Another JSON Schema Validator) for fast, schema-based validation

**Key MCP Response Structure**:
```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "result": {
    "content": [...],
    "isError": false
  }
}
```

**Validation Strategy**:
- Pre-load MCP JSON schema at proxy startup
- Validate all responses from backend MCP servers before filtering
- Log schema violations and optionally reject malformed responses (configurable)

**Reference**: MCP specification at https://modelcontextprotocol.io/specification

### 3. Docker Base Images for Node.js Proxy

**Decision**: Use **node:20-alpine** as production base image

**Rationale**:
- Alpine Linux → small image size (~50MB vs ~900MB for full Debian)
- Node.js 20.x LTS → long-term support until April 2026
- Official Node.js image → security updates and best practices maintained
- Multi-stage builds for production (separate build and runtime stages)

**Development Image**: `node:20` (full Debian) for development to support all debugging tools

**Health Check Pattern**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1
```

**Alternatives Considered**:
- **node:20-slim**: Slightly smaller than full Debian but larger than Alpine
- **Distroless**: Maximum security but harder to debug in production

**Docker Compose Structure** (local development):
```yaml
version: '3.8'
services:
  proxy:
    build: ./docker/Dockerfile.dev
    volumes:
      - ./src:/app/src
      - ./config:/app/config
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - CONFIG_PATH=/app/config/proxy.json
  
  mock-mcp-server:
    image: mockserver/mockserver:latest
    ports:
      - "5000:1080"
```

### 4. Filter Engine Architecture

**Decision**: Rule-based engine with expression evaluator (JSONPath + custom operators)

**Rationale**:
- Declarative filter rules stored in JSON/YAML
- Use JSONPath for field matching (e.g., `$.result.content[0].type == "text"`)
- Support composite rules with AND/OR logic via rule metadata
- Fast evaluation using pre-compiled rule trees

**Filter Rule Schema**:
```json
{
  "id": "filter-001",
  "name": "Block dangerous tools",
  "enabled": true,
  "condition": {
    "field": "$.result.toolName",
    "operator": "equals",
    "value": "dangerous_tool"
  },
  "action": "drop",
  "composition": "AND"
}
```

**Libraries**:
- `jsonpath-plus`: JSONPath query engine
- Custom expression compiler for performance (pre-compile rules at config load)

**Performance Target**: <10ms per filter evaluation (p95) → achieved via rule indexing and short-circuit evaluation

**Alternatives Considered**:
- **JavaScript eval()**: Security risk, disabled in production environments
- **VM2 sandboxing**: Overhead too high for per-request evaluation
- **Rule engines (json-rules-engine)**: Good but adds dependency; custom engine gives more control

### 5. Transformation Engine Pattern

**Decision**: Pipeline-based transformation with JSONata for field operations

**Rationale**:
- JSONata is a lightweight JSON query/transformation language
- Supports field extraction, restructuring, redaction in single expression
- Transformations are composable (chained pipeline)
- Pre-compile JSONata expressions at config load for performance

**Transformation Rule Schema**:
```json
{
  "id": "transform-001",
  "name": "Redact API keys",
  "enabled": true,
  "expression": "$ ~> |result.content|{'api_key': '[REDACTED]'}|",
  "order": 1
}
```

**Transformation Pipeline**:
1. Load transformation rules sorted by `order` field
2. Apply each transformation sequentially to response
3. Each transformation operates on output of previous transformation
4. If transformation expression fails (missing field), pass through unchanged

**Libraries**:
- `jsonata`: JSON transformation language
- `lodash`: Utility functions for deep object manipulation

**Performance Target**: <10ms per transformation (p95) → use pre-compiled expressions and streaming for large responses

**Alternatives Considered**:
- **jq-style CLI tools**: Powerful but requires spawning child processes (too slow)
- **Custom JavaScript functions**: Flexible but requires code injection (security concern)

### 6. Plugin System Architecture

**Decision**: V8 isolate-based plugin execution with documented API

**Rationale**:
- Plugins are JavaScript/Node.js code (per spec clarification)
- Use Node.js VM module or `isolated-vm` for sandboxed execution
- Plugin API provides access to request/response context, logging, and config
- Plugins loaded at startup; hot-reload triggers plugin re-initialization

**Plugin API Interface**:
```javascript
// Plugin entrypoint
module.exports = {
  name: 'rate-limiter',
  version: '1.0.0',
  
  async filter(context) {
    // context = {request, response, logger, config}
    // return {action: 'allow'|'drop', reason: '...'}
    const user = context.request.headers['x-user-id'];
    const limited = await checkRateLimit(user);
    if (limited) {
      return {action: 'drop', reason: `Rate limit exceeded for ${user}`};
    }
    return {action: 'allow'};
  },
  
  async transform(context) {
    // Optional: modify response before forwarding
    // return modified response or null to skip
    return null;
  }
};
```

**Plugin Execution Order**: Filters run first (drop early), then transformations

**Error Handling**: Plugins specify error behavior in config:
```json
{
  "plugin": "rate-limiter",
  "errorBehavior": "fail-open",  // or "fail-secure", "retry"
  "retryAttempts": 3
}
```

**Libraries**:
- `isolated-vm`: Secure V8 isolate for plugin execution
- Custom plugin loader with dependency injection

**Alternatives Considered**:
- **Worker threads**: Good isolation but higher overhead (separate process)
- **Child processes**: Maximum isolation but very slow (100ms+ overhead per request)

### 7. Configuration Hot-Reload Mechanism

**Decision**: File watcher with atomic config swap and zero-downtime reload

**Rationale**:
- Use `chokidar` to watch config files for changes
- On change: validate new config → compile rules → atomic swap → log reload event
- In-flight requests use old config; new requests use new config immediately
- No server restart required

**Hot-Reload Flow**:
1. File watcher detects config change
2. Load and validate new config (JSON schema validation)
3. Compile filter rules, transformation expressions, load plugins
4. If validation succeeds: atomically swap config reference
5. If validation fails: log error, keep old config active, notify operators

**Configuration Validation**: JSON Schema validation before reload to prevent invalid config from breaking proxy

**Libraries**:
- `chokidar`: File system watcher
- `ajv`: JSON schema validator

**Target**: <5 seconds from file change to config active (per spec SC-003)

**Alternatives Considered**:
- **Polling config files**: Simpler but introduces delay and unnecessary I/O
- **Management API with persistence**: More complex; config file is source of truth

## Resolved Clarifications

| Original Clarification | Resolution |
|------------------------|------------|
| Container deployment details | node:20-alpine base image, health check via `/health` endpoint, Docker Compose for local dev |
| Test framework selection | Jest for unit tests, Supertest for integration tests, Istanbul for coverage |
| Filter rule composition semantics | Rules specify AND/OR/custom via metadata; engine supports composite expressions |
| Plugin runtime language | JavaScript/Node.js with isolated-vm for sandboxed execution |
| Plugin error handling default | Configurable per plugin: fail-open, fail-secure, or custom retry logic |
| Response size threshold for streaming | 10MB threshold: <10MB processed synchronously, >10MB streamed to avoid memory exhaustion |

## Technology Stack Summary

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| HTTP Server | Fastify | Performance, async/await, schema validation |
| MCP Validation | ajv + JSON Schema | Fast validation, spec compliance |
| Filter Engine | JSONPath + custom compiler | Declarative rules, <10ms evaluation |
| Transform Engine | JSONata | JSON transformation language, composable |
| Plugin System | isolated-vm | Sandboxed JavaScript execution |
| Config Hot-Reload | chokidar + atomic swap | Zero-downtime reload |
| Testing | Jest + Supertest | Industry standard, good TypeScript support |
| Container | node:20-alpine | Small image, LTS support |
| Logging | Pino | Fast structured logging |
| Metrics | prom-client (optional) | Prometheus-compatible metrics |

## Next Phase

Phase 1: Design artifacts (data-model.md, contracts/, quickstart.md)
