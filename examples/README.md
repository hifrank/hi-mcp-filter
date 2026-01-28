# Examples

This directory contains example configuration and request payloads for SSE transport.

- sse-config.json: Minimal SSE configuration for a backend MCP server.
- sse-request.json: JSON-RPC initialize request payload for testing.

Usage example:

1. Start the proxy with the example config:
   CONFIG_FILE=./examples/sse-config.json npm run dev

2. Send the request:
   curl -X POST http://localhost:8080/proxy/azure-apim \
     -H "Content-Type: application/json" \
     -d @examples/sse-request.json
