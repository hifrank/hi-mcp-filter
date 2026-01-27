# Data Model: MCP Response Filter Proxy

**Feature**: MCP Response Filter Proxy  
**Created**: 2026-01-27  
**Purpose**: Define core entities, relationships, and state management

## Core Entities

### 1. MCPResponse

Represents an incoming response from a backend MCP server.

**Fields**:
- `id`: string (JSON-RPC request ID)
- `jsonrpc`: string (protocol version, always "2.0")
- `result`: object (MCP result payload)
  - `content`: array (response content items)
  - `isError`: boolean (error indicator)
  - `meta`: object (optional metadata)
- `error`: object (optional, present if request failed)
  - `code`: number (error code)
  - `message`: string (error description)
- `headers`: object (HTTP headers from backend)
- `timestamp`: number (Unix timestamp when proxy received response)
- `sourceServer`: string (backend MCP server identifier)

**Validation Rules**:
- `jsonrpc` MUST equal "2.0"
- Either `result` or `error` MUST be present, not both
- `id` MUST match the original request ID

**State Transitions**: 
Received → Validated → Filtered → Transformed → Forwarded

---

### 2. FilterRule

Declarative rule that determines if a response should be forwarded or dropped.

**Fields**:
- `id`: string (unique rule identifier)
- `name`: string (human-readable rule name)
- `enabled`: boolean (rule active status)
- `condition`: object (matching criteria)
  - `field`: string (JSONPath expression, e.g., "$.result.content[0].type")
  - `operator`: enum ("equals", "contains", "matches", "exists", "not")
  - `value`: any (comparison value)
- `action`: enum ("allow", "drop")
- `composition`: enum ("AND", "OR", "NONE") (how this rule combines with others)
- `priority`: number (evaluation order, lower = higher priority)

**Validation Rules**:
- `id` MUST be unique across all filter rules
- `condition.field` MUST be a valid JSONPath expression
- `operator` MUST be one of supported operators
- Rules with same priority evaluated in alphabetical order by `id`

**Relationships**:
- Multiple FilterRules can match a single MCPResponse
- Composition logic determines final action (AND/OR aggregation)

---

### 3. TransformationRule

Declarative rule that modifies response content before forwarding.

**Fields**:
- `id`: string (unique transformation identifier)
- `name`: string (human-readable transformation name)
- `enabled`: boolean (transformation active status)
- `expression`: string (JSONata transformation expression)
- `order`: number (execution order in transformation pipeline)
- `onError`: enum ("skip", "passthrough", "fail") (behavior when transformation fails)

**Validation Rules**:
- `id` MUST be unique across all transformation rules
- `expression` MUST be valid JSONata syntax
- `order` determines execution sequence (lower order = earlier in pipeline)

**Relationships**:
- TransformationRules execute sequentially based on `order`
- Each transformation operates on output of previous transformation

---

### 4. Plugin

Custom JavaScript code that implements domain-specific filtering or transformation logic.

**Fields**:
- `name`: string (plugin identifier)
- `version`: string (semantic version)
- `filePath`: string (path to plugin JavaScript file)
- `enabled`: boolean (plugin active status)
- `errorBehavior`: enum ("fail-open", "fail-secure", "retry") (error handling mode)
- `retryAttempts`: number (retry count for "retry" mode, default: 3)
- `timeout`: number (plugin execution timeout in ms, default: 5000)

**Plugin Interface** (JavaScript):
```javascript
module.exports = {
  name: string,
  version: string,
  
  // Optional: filter function (return {action, reason})
  async filter(context: PluginContext): Promise<FilterResult>,
  
  // Optional: transform function (return modified response or null)
  async transform(context: PluginContext): Promise<MCPResponse | null>
};
```

**Validation Rules**:
- Plugin file MUST export object with `name` and `version`
- At least one of `filter` or `transform` MUST be implemented
- Plugin MUST complete within `timeout` or be terminated

**Relationships**:
- Plugins execute after declarative FilterRules but before TransformationRules
- Multiple plugins execute in load order (defined in config)

---

### 5. ProxyConfiguration

Runtime configuration loaded from JSON/YAML file.

**Fields**:
- `server`: object
  - `port`: number (proxy listen port, default: 8080)
  - `host`: string (bind address, default: "0.0.0.0")
  - `requestTimeout`: number (max request duration ms, default: 30000)
- `mcpServers`: array of objects (backend MCP server definitions)
  - `id`: string (server identifier)
  - `url`: string (backend URL, e.g., "http://mcp-server:5000")
  - `timeout`: number (backend request timeout ms)
- `filters`: array of FilterRule (declarative filter rules)
- `transformations`: array of TransformationRule (transformation rules)
- `plugins`: array of Plugin (custom plugin definitions)
- `logging`: object
  - `level`: enum ("trace", "debug", "info", "warn", "error")
  - `format`: enum ("json", "pretty")
- `hotReload`: object
  - `enabled`: boolean (watch config files for changes)
  - `debounceMs`: number (delay before applying changes, default: 1000)

**Validation Rules**:
- Configuration MUST pass JSON Schema validation before load
- Hot-reload validates new config before swapping
- Invalid config during hot-reload preserves existing config

---

### 6. ProxyContext

Runtime state and metrics for active proxy instance.

**Fields**:
- `config`: ProxyConfiguration (active configuration)
- `activeRequests`: Map<string, RequestContext> (in-flight requests by ID)
- `statistics`: object
  - `totalRequests`: number (lifetime request count)
  - `filteredRequests`: number (dropped by filters)
  - `transformedRequests`: number (modified by transformations)
  - `pluginExecutions`: number (plugin invocation count)
  - `errors`: number (error count)
- `pluginCache`: Map<string, LoadedPlugin> (loaded and initialized plugins)
- `compiledFilters`: array (pre-compiled filter rule evaluators)
- `compiledTransformations`: array (pre-compiled JSONata expressions)
- `startTime`: number (proxy start timestamp)
- `lastConfigReload`: number (last config hot-reload timestamp)

**Lifecycle**:
- Created at proxy startup
- Updated during hot-reload (atomic config swap)
- Persists until proxy shutdown

---

## Entity Relationships

```
MCPResponse
  ├─ evaluated by → FilterRule[] (0..n)
  ├─ evaluated by → Plugin[] (0..n)
  ├─ transformed by → TransformationRule[] (0..n)
  └─ logged to → AuditLog (1)

ProxyConfiguration
  ├─ contains → FilterRule[] (0..n)
  ├─ contains → TransformationRule[] (0..n)
  ├─ contains → Plugin[] (0..n)
  └─ loaded into → ProxyContext (1)

ProxyContext
  ├─ manages → ActiveRequests (Map)
  ├─ caches → LoadedPlugins (Map)
  └─ tracks → Statistics (object)
```

## State Management

### Request Lifecycle State

1. **Received**: Request arrives from Azure API Management
2. **Routed**: Request forwarded to backend MCP server
3. **ResponseReceived**: MCP server returns response
4. **Validated**: Response validated against MCP JSON-RPC schema
5. **Filtered**: Filter rules applied (may drop response)
6. **PluginFiltered**: Custom plugins evaluate response
7. **Transformed**: Transformation rules applied sequentially
8. **Forwarded**: Modified response sent to API Management
9. **Logged**: Request/response logged for audit trail

### Configuration State

1. **Loaded**: Configuration read from file at startup
2. **Validated**: JSON schema validation passed
3. **Compiled**: Filter/transformation rules pre-compiled
4. **Active**: Configuration in use for request processing
5. **Reloading**: New configuration detected, validation in progress
6. **Swapped**: New configuration atomically replaces old

### Plugin State

1. **Discovered**: Plugin file found in config
2. **Loaded**: Plugin JavaScript module loaded into memory
3. **Validated**: Plugin interface validated (exports filter/transform)
4. **Cached**: Plugin instance stored in plugin cache
5. **Executing**: Plugin processing a request
6. **Completed**: Plugin returned result
7. **Error**: Plugin threw exception or timed out

---

## Data Flow

```
[API Management] 
    ↓ HTTP Request
[Proxy Server] 
    ↓ Forward to Backend
[MCP Server]
    ↓ MCP Response (MCPResponse entity)
[Validation Layer] 
    ↓ Schema validation
[Filter Engine] 
    ↓ Apply FilterRules
    ├─ Drop? → [Audit Log]
    └─ Allow? ↓
[Plugin System]
    ↓ Execute Plugins
    ├─ Drop? → [Audit Log]
    └─ Allow? ↓
[Transformation Engine]
    ↓ Apply TransformationRules
[Response Forwarder]
    ↓ Modified Response
[API Management]
```

---

## Performance Considerations

- **Filter Rule Indexing**: Pre-compile JSONPath expressions at config load
- **Plugin Caching**: Load plugins once, reuse across requests
- **Transformation Pre-compilation**: Compile JSONata expressions at config load
- **Streaming**: Responses >10MB streamed to avoid memory exhaustion
- **Statistics**: Use atomic counters for metrics (no locks)

---

## Next Phase

Phase 1 (continued): API contracts (contracts/) and quickstart guide (quickstart.md)
