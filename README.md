# MCP Response Filter Proxy

A proxy server that sits between Azure API Management and Model Context Protocol (MCP) servers to filter and modify MCP responses.

## Features

- **Response Filtering**: Declarative rules to match and drop/allow responses based on patterns
- **Response Transformation**: Modify response content using JSONata expressions
- **Custom Plugins**: Write JavaScript plugins for domain-specific business logic
- **Hot Reload**: Update configuration without restarting the proxy
- **Container Native**: Docker/AKS/Azure Container Apps ready
- **Production Ready**: Health checks, metrics, logging, graceful shutdown

## Quick Start

### Prerequisites

- Node.js 20.x LTS
- npm or yarn

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev
# Test the server
curl http://localhost:8080/health
curl http://localhost:8080/metrics
curl http://localhost:8080/config


# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Build for Production

```bash
npm run build
npm start
```

### Docker

```bash
# Build Docker image
docker build -f docker/Dockerfile -t hi-mcp-filter:latest .

# Run locally with Docker Compose
docker-compose -f docker/docker-compose.yml up
```

## Configuration

Configuration files are located in the `config/` directory:

- `proxy.example.json` - Proxy server settings
- `filters.example.json` - Filter rules
- `transforms.example.json` - Transformation rules

Copy example files and modify as needed:

```bash
cp config/proxy.example.json config/proxy.json
cp config/filters.example.json config/filters.json
cp config/transforms.example.json config/transforms.json
```

## API Endpoints

### Health Check

```
GET /health
```

Returns proxy health status (liveness check).

### Proxy Endpoint

```
POST /proxy/:serverId
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": "request-id",
  "method": "tool_call",
  "params": {}
}
```

Forwards requests to the specified MCP server and returns filtered/transformed responses.

## Architecture

```
src/
├── proxy/          # HTTP server and request routing
├── mcp/            # MCP protocol validation
├── filter/         # Declarative filter engine
├── transform/      # Response transformation engine
├── plugin/         # Custom plugin loader and execution
├── config/         # Configuration management and hot-reload
└── common/         # Shared utilities (logging, metrics, errors)

tests/
├── unit/           # Component-level tests
├── integration/    # End-to-end proxy flow tests
└── fixtures/       # Test data
```

## Development Guide

### Adding a Filter Rule

Filter rules use JSONPath expressions to match response patterns. Example:

```json
{
  "id": "block-dangerous-tool",
  "name": "Block dangerous_tool responses",
  "enabled": true,
  "condition": {
    "field": "$.result.content[0].name",
    "operator": "equals",
    "value": "dangerous_tool"
  },
  "action": "drop",
  "composition": "NONE",
  "priority": 1
}
```

### Writing a Custom Plugin

Plugins are JavaScript modules that implement filter or transform logic:

```javascript
// plugins/my-plugin.js
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',

  async filter(context) {
    const { request, response, logger } = context;
    
    // Custom filtering logic
    if (shouldBlock(response)) {
      return {
        action: 'drop',
        reason: 'Matched custom filter',
      };
    }

    return {
      action: 'allow',
      reason: 'Passed custom filter',
    };
  },

  async transform(context) {
    const { response, logger } = context;

    // Custom transformation logic
    return modifyResponse(response);
  },
};
```

## Testing

Tests are organized into two categories:

- **Unit Tests**: Component-level tests for filter, transform, plugin, and config modules
- **Integration Tests**: End-to-end tests for complete proxy flows

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test tests/unit/filter/rule-matcher.test.ts

# Watch mode
npm run test:watch
```

## Deployment

### Azure Container Apps

```bash
# Create container registry
az acr create --resource-group mygroup --name myregistry --sku Basic

# Build and push image
docker build -f docker/Dockerfile -t myregistry.azurecr.io/hi-mcp-filter:latest .
docker push myregistry.azurecr.io/hi-mcp-filter:latest

# Deploy to Container Apps
az containerapp create \
  --resource-group mygroup \
  --name hi-mcp-filter \
  --image myregistry.azurecr.io/hi-mcp-filter:latest \
  --environment myenv \
  --ingress external \
  --target-port 8080
```

### Azure Kubernetes Service (AKS)

See `quickstart.md` for detailed AKS deployment instructions.

## License

MIT

## Support

For issues or questions, please open an issue on the project repository.
