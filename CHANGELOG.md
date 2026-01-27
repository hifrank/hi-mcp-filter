# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-XX

### Added
- Initial release of MCP Response Filter Proxy
- Core proxy server with request routing and forwarding
- MCP JSON-RPC 2.0 protocol validation
- Filter engine with JSONPath-based rule matching
- Transformation pipeline with configurable rules
- Plugin system with timeout and retry support
- Configuration hot-reload mechanism
- Comprehensive logging with Pino
- Docker and Kubernetes deployment support
- Metrics endpoint with Prometheus format
- Graceful shutdown handling
- Distributed tracing header support

### Security
- Non-root container execution
- Read-only root filesystem in Kubernetes
- Resource limits and requests
- Pod disruption budgets
- Health checks and readiness probes

### Documentation
- API documentation
- Kubernetes deployment guide
- Docker setup instructions
- Configuration reference
- Plugin development guide
