# Quickstart: MCP SSE Transport Support

**Feature**: MCP SSE Transport Support  
**Created**: 2026-01-27  
**Audience**: Developers testing SSE transport integration

## Overview

This guide shows how to configure and test the proxy with SSE-based MCP servers, particularly Azure API Management MCP endpoints.

---

## Prerequisites

- MCP proxy with SSE support installed (feature 002)
- Access to SSE-based MCP server (e.g., Azure APIM MCP endpoint)
- OR local SSE test server for development

---

## Quick Start

### 1. Configure SSE Transport

Edit `config/default.json` to add SSE server:

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
      "timeout": 30000
    },
    {
      "id": "http-server",
      "url": "http://localhost:5000",
      "transport": "http"
    }
  ]
}
```

### 2. Start Proxy

```bash
npm run dev
```

### 3. Test SSE Endpoint

```bash
# Send initialize request to Azure APIM SSE endpoint
curl -X POST http://localhost:8080/proxy/azure-apim \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"initialize",
    "params":{
      "protocolVersion":"2024-11-05",
      "capabilities":{},
      "clientInfo":{"name":"test","version":"1.0.0"}
    },
    "id":1
  }'
```

**Expected Response**:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {"tools": {"listChanged": true}},
    "serverInfo": {"name": "Azure API Management", "version": "1.0.0"}
  }
}
```

---

## Configuration Options

### Transport Types

- `"http"`: Force HTTP JSON-RPC transport
- `"sse"`: Force Server-Sent Events transport
- `"auto"`: Auto-detect based on Content-Type header (default)

### SSE Options

```json
{
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
  ]
}
```

**Fields**:
- `sseEventFilter`: Array of event types to process (default: `["message"]`)
- `sseBufferSize`: Maximum events to buffer (default: 10, max: 1000)

---

## Testing with Mock SSE Server

### Create Mock SSE Server

```javascript
// mock-sse-server.js
const http = require('http');

http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const request = JSON.parse(body);
      
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      // Send SSE response
      res.write(`event: message\n`);
      res.write(`data: ${JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: {message: "Hello from SSE"}
      })}\n\n`);
      
      res.write(`event: close\n`);
      res.write(`data: \n\n`);
      
      res.end();
    });
  }
}).listen(5001);

console.log('Mock SSE server running on http://localhost:5001');
```

### Test Mock Server

```bash
# Start mock server
node mock-sse-server.js

# Configure proxy
{
  "mcpServers": [{
    "id": "mock-sse",
    "url": "http://localhost:5001",
    "transport": "sse"
  }]
}

# Test through proxy
curl -X POST http://localhost:8080/proxy/mock-sse \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"test","id":1}'
```

---

## Troubleshooting

### SSE Parsing Errors

**Error**: `Backend SSE stream error: Invalid JSON in SSE data field`

**Cause**: SSE `data:` field contains malformed JSON

**Solution**: Check backend server logs, verify JSON-RPC format

---

### Timeout Errors

**Error**: `SSE stream timeout after 30000ms`

**Cause**: Backend SSE server not sending events or not closing stream

**Solution**: 
- Increase timeout in config: `"timeout": 60000`
- Check backend server is sending `event: close`

---

### Transport Detection Issues

**Error**: `Unsupported backend transport`

**Cause**: Auto-detection failed (unexpected Content-Type)

**Solution**: Explicitly set `"transport": "sse"` or `"http"` in config

---

### Connection Refused

**Error**: `ECONNREFUSED`

**Cause**: Backend server not reachable

**Solution**: Verify backend URL, check network connectivity

---

## Advanced Configuration

### Mixed HTTP and SSE Servers

```json
{
  "mcpServers": [
    {
      "id": "sse-server-1",
      "url": "https://api1.example.com/mcp",
      "transport": "sse"
    },
    {
      "id": "http-server-1",
      "url": "http://localhost:5000",
      "transport": "http"
    },
    {
      "id": "auto-detect",
      "url": "https://api2.example.com/mcp",
      "transport": "auto"
    }
  ]
}
```

### With Filters (SSE responses filtered like HTTP)

```json
{
  "filterRules": [
    {
      "id": "filter-001",
      "name": "Block dangerous tools",
      "enabled": true,
      "condition": {
        "type": "jsonpath",
        "path": "$.result.tools[*].name",
        "operator": "contains",
        "value": "dangerous"
      },
      "action": {
        "type": "drop"
      }
    }
  ]
}
```

Filters apply to JSON-RPC messages extracted from SSE streams.

---

## Docker Deployment

### Dockerfile (unchanged)

SSE support works in existing Docker deployment:

```bash
# Build image
docker build -t mcp-proxy:sse -f docker/Dockerfile .

# Run with SSE config
docker run -d \
  -p 8080:8080 \
  -v $(pwd)/config:/app/config \
  -e CONFIG_FILE=/app/config/sse-config.json \
  mcp-proxy:sse
```

---

## Performance Testing

### Measure SSE Latency

```bash
# Install hey (HTTP load testing tool)
brew install hey

# Test SSE endpoint
hey -n 100 -c 10 \
  -m POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}},"id":1}' \
  http://localhost:8080/proxy/azure-apim
```

**Expected**:
- p50 latency: <150ms (backend + SSE parsing)
- p95 latency: <200ms
- SSE parsing overhead: <10ms

---

## Next Steps

- Configure filters for SSE responses
- Add transformations to modify extracted JSON-RPC
- Monitor SSE connection metrics at `/metrics` endpoint
- Test graceful shutdown with active SSE connections

---

## References

- [MCP Specification](https://modelcontextprotocol.io/specification)
- [Server-Sent Events (SSE) Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)
- [eventsource-parser Library](https://github.com/rexxars/eventsource-parser)
