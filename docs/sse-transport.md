# SSE Transport Support

This document explains how to use Server-Sent Events (SSE) transport with the proxy, including configuration, examples, and metrics.

## Overview

The proxy supports three transport modes per MCP server:

- **http**: Expect JSON-RPC responses over HTTP.
- **sse**: Expect JSON-RPC responses wrapped in SSE events.
- **auto**: Auto-detect the transport from the backend Content-Type header.

SSE responses are parsed and converted into standard JSON-RPC responses before filter and transform rules are applied.

## Configuration

### Basic SSE Transport

```json
{
  "mcpServers": [
    {
      "id": "azure-apim",
      "url": "https://example.azure-api.net/me/mcp",
      "transport": "sse",
      "timeout": 30000
    }
  ]
}
```

### SSE Options

```json
{
  "mcpServers": [
    {
      "id": "azure-apim",
      "url": "https://example.azure-api.net/me/mcp",
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
- `sseEventFilter`: Event types to process (default: `message`).
- `sseBufferSize`: Maximum buffered events (default: 10, max: 1000).

## Examples

### Curl request

```bash
curl -X POST http://localhost:8080/proxy/azure-apim \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"cli","version":"1.0.0"}},"id":1}'
```

### Expected SSE backend flow

```
event: message
data: {"jsonrpc":"2.0","id":1,"result":{...}}

event: close
data:
```

The proxy extracts the JSON-RPC object from the SSE stream and returns a normal JSON response to the client.

## Metrics

SSE-specific metrics are exposed at `/metrics`:

- `sse_events_parsed_total`: Total number of SSE events parsed
- `sse_parse_errors_total`: Total number of SSE parse errors
- `sse_timeouts_total`: Total number of SSE timeouts

These metrics can be scraped by Prometheus alongside the existing proxy metrics.

## Troubleshooting

### Parsing errors

If you see errors like `Backend SSE stream error: Invalid JSON in SSE data field`, verify that the backend sends valid JSON-RPC in the `data:` field.

### Timeouts

If timeouts occur, ensure the backend sends a `close` event or increase the server timeout in config:

```json
{ "mcpServers": [{ "id": "azure-apim", "timeout": 60000 }] }
```

## Related documentation

- [Quickstart](../specs/002-mcp-sse-transport/quickstart.md)
- [SSE Proxy Contract](../specs/002-mcp-sse-transport/contracts/sse-proxy-endpoint.md)
- [Transport Configuration Contract](../specs/002-mcp-sse-transport/contracts/transport-config.md)
