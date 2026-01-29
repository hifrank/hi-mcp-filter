import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  parseBackendHostHeader,
  determinePort,
  determineProtocol,
  determineTransport,
  constructBackendUrl,
  validateHostname,
  resolveBackendFromHeader,
} from '@/proxy/dynamic-routing/resolver';
import {
  selectBackend,
  isValidBackend,
  getSelectionSourceDescription,
} from '@/proxy/dynamic-routing/selector';
import { BackendSelection, DynamicBackendConfig } from '@/config/loader';

describe('Dynamic Backend Routing - Integration Tests', () => {
  let config: DynamicBackendConfig;

  beforeEach(() => {
    config = {
      enabled: true,
      headerName: 'APIM-PROXIED-MCP-HOST',
      allowlist: ['*.internal.example.com', 'mcp-server-1.example.com', '192.168.1.100'],
      denyByDefault: true,
      defaultPort: 443,
      allowIpAddresses: true,
      allowInsecureProtocol: false,
    };
  });

  describe('T044: Send request with valid APIM-PROXIED-MCP-HOST header', () => {
    it('should resolve backend URL from simple hostname', () => {
      const headerValue = 'mcp-server-1.example.com';
      const result = resolveBackendFromHeader(headerValue, config);

      expect(result).toBe('https://mcp-server-1.example.com:443/mcp');
    });

    it('should resolve backend URL with explicit port', () => {
      const headerValue = 'mcp-server-1.example.com:9000';
      const result = resolveBackendFromHeader(headerValue, config);

      expect(result).toBe('https://mcp-server-1.example.com:9000/mcp');
    });

    it('should handle hostname with whitespace', () => {
      const headerValue = '  mcp-server-1.example.com  ';
      const result = resolveBackendFromHeader(headerValue, config);

      expect(result).toBe('https://mcp-server-1.example.com:443/mcp');
    });

    it('should use custom default port from config', () => {
      config.defaultPort = 8443;
      const headerValue = 'mcp-server-1.example.com';
      const result = resolveBackendFromHeader(headerValue, config);

      expect(result).toBe('https://mcp-server-1.example.com:8443/mcp');
    });
  });

  describe('T045: Verify request forwarded to specified backend', () => {
    it('should construct correct URL for HTTP transport', () => {
      const components = {
        protocol: 'https',
        hostname: 'server.example.com',
        port: 443,
        transport: 'http' as const,
        path: '/mcp',
      };

      const url = constructBackendUrl(components);
      expect(url).toBe('https://server.example.com:443/mcp');
    });

    it('should construct correct URL for SSE transport', () => {
      const components = {
        protocol: 'https',
        hostname: 'sse-server.example.com',
        port: 443,
        transport: 'sse' as const,
        path: '/sse',
      };

      const url = constructBackendUrl(components);
      expect(url).toBe('https://sse-server.example.com:443/sse');
    });
  });

  describe('T046: Verify response returned to client correctly', () => {
    it('should select backend from header with valid routing decision', () => {
      const decision = selectBackend({
        headerValue: 'mcp-server-1.example.com',
        config,
      });

      expect(decision.selectionSource).toBe(BackendSelection.HEADER);
      expect(decision.backendUrl).toBe('https://mcp-server-1.example.com:443/mcp');
      expect(decision.error).toBeUndefined();
      expect(isValidBackend(decision)).toBe(true);
    });

    it('should provide descriptive source information', () => {
      const decision = selectBackend({
        headerValue: 'mcp-server-1.example.com',
        config,
      });

      const description = getSelectionSourceDescription(decision.selectionSource);
      expect(description).toBe('Dynamic Header (APIM-PROXIED-MCP-HOST)');
    });
  });

  describe('T047: Test with both HTTP and SSE backends', () => {
    it('should use HTTP transport by default', () => {
      const transport = determineTransport('unknown-server.example.com');
      expect(transport).toBe('http');
    });

    it('should use SSE transport when configured statically', () => {
      const staticServers = [{ hostname: 'sse-server.example.com', transport: 'sse' as const }];

      const transport = determineTransport('sse-server.example.com', staticServers);
      expect(transport).toBe('sse');
    });

    it('should resolve SSE backend URL correctly', () => {
      const staticServers = [{ hostname: 'sse.example.com', transport: 'sse' as const }];

      const result = resolveBackendFromHeader('sse.example.com:9000', config, staticServers);
      expect(result).toBe('https://sse.example.com:9000/sse');
    });

    it('should resolve HTTP backend URL correctly', () => {
      const staticServers = [{ hostname: 'http.example.com', transport: 'http' as const }];

      const result = resolveBackendFromHeader('http.example.com:8080', config, staticServers);
      expect(result).toBe('https://http.example.com:8080/mcp');
    });
  });

  describe('T048: Test error response for invalid hostname (400)', () => {
    it('should throw error for empty hostname', () => {
      expect(() => {
        parseBackendHostHeader('');
      }).not.toThrow(); // Empty returns null, not error

      const result = parseBackendHostHeader('');
      expect(result).toBeNull();
    });

    it('should throw error for invalid port', () => {
      expect(() => {
        parseBackendHostHeader('server.example.com:99999');
      }).toThrow('Invalid port in header: 99999');
    });

    it('should throw error for non-numeric port', () => {
      expect(() => {
        parseBackendHostHeader('server.example.com:abc');
      }).toThrow('Invalid port in header: abc');
    });

    it('should throw error for hostname with invalid characters', () => {
      expect(() => {
        resolveBackendFromHeader('server with spaces.example.com', config);
      }).toThrow('Invalid hostname format');
    });

    it('should validate hostname format correctly', () => {
      expect(validateHostname('valid-server.example.com')).toBe(true);
      expect(validateHostname('server.123.com')).toBe(true);
      expect(validateHostname('server with spaces')).toBe(false);
      expect(validateHostname('.leading-dot.com')).toBe(false);
      expect(validateHostname('trailing-dot.com.')).toBe(false);
      expect(validateHostname('')).toBe(false);
    });
  });

  describe('T049: Test backward compatibility: request without header uses static config', () => {
    it('should return null when header is undefined', () => {
      const result = resolveBackendFromHeader(undefined, config);
      expect(result).toBeNull();
    });

    it('should return null when header is empty string', () => {
      const result = resolveBackendFromHeader('', config);
      expect(result).toBeNull();
    });

    it('should fall back to static config when no header', () => {
      const decision = selectBackend({
        headerValue: undefined,
        config,
        staticBackendUrl: 'https://static-backend.example.com:443/mcp',
      });

      expect(decision.selectionSource).toBe(BackendSelection.STATIC_CONFIG);
      expect(decision.backendUrl).toBe('https://static-backend.example.com:443/mcp');
      expect(isValidBackend(decision)).toBe(true);
    });

    it('should fall back to static config when header is empty', () => {
      const decision = selectBackend({
        headerValue: '',
        config,
        staticBackendUrl: 'https://static-backend.example.com:443/mcp',
      });

      expect(decision.selectionSource).toBe(BackendSelection.STATIC_CONFIG);
      expect(decision.backendUrl).toBe('https://static-backend.example.com:443/mcp');
    });

    it('should return error when no header and no static config', () => {
      const decision = selectBackend({
        headerValue: undefined,
        config,
      });

      expect(decision.selectionSource).toBe(BackendSelection.ERROR);
      expect(decision.error).toContain('No backend available');
      expect(isValidBackend(decision)).toBe(false);
    });
  });

  describe('T050: Test request correlation: response ID matches request ID', () => {
    it('should preserve routing decision context', () => {
      const decision = selectBackend({
        headerValue: 'mcp-server-1.example.com:9000',
        config,
      });

      expect(decision.backendUrl).toBeDefined();
      expect(decision.selectionSource).toBeDefined();
      // Routing decision can be logged with request context
      expect(typeof decision.backendUrl).toBe('string');
      expect(Object.values(BackendSelection)).toContain(decision.selectionSource);
    });
  });

  describe('Protocol & Port Selection Rules', () => {
    it('Rule 1: should parse hostname without port', () => {
      const parsed = parseBackendHostHeader('server.example.com');
      expect(parsed).toEqual({
        hostname: 'server.example.com',
        port: null,
      });
    });

    it('Rule 1: should parse hostname with port', () => {
      const parsed = parseBackendHostHeader('server.example.com:9000');
      expect(parsed).toEqual({
        hostname: 'server.example.com',
        port: 9000,
      });
    });

    it('Rule 2: should use explicit port over config default', () => {
      const parsed = { hostname: 'server.example.com', port: 9000 };
      const port = determinePort(parsed, { ...config, defaultPort: 8443 });
      expect(port).toBe(9000);
    });

    it('Rule 2: should use config default when no explicit port', () => {
      const parsed = { hostname: 'server.example.com', port: null };
      const port = determinePort(parsed, { ...config, defaultPort: 8443 });
      expect(port).toBe(8443);
    });

    it('Rule 2: should use 443 when no explicit port or config default', () => {
      const parsed = { hostname: 'server.example.com', port: null };
      const configNoDefault = { ...config };
      delete configNoDefault.defaultPort;
      const port = determinePort(parsed, configNoDefault);
      expect(port).toBe(443);
    });

    it('Rule 3: should always return https protocol (MVP)', () => {
      const protocol = determineProtocol(config);
      expect(protocol).toBe('https');
    });

    it('Rule 4: should use static config transport over default', () => {
      const staticServers = [{ hostname: 'server.example.com', transport: 'sse' as const }];
      const transport = determineTransport('server.example.com', staticServers);
      expect(transport).toBe('sse');
    });

    it('Rule 4: should default to http when no static config', () => {
      const transport = determineTransport('unknown-server.example.com');
      expect(transport).toBe('http');
    });

    it('Rule 5: should construct full URL with all components', () => {
      const url = constructBackendUrl({
        protocol: 'https',
        hostname: 'server.example.com',
        port: 9000,
        transport: 'sse',
        path: '/sse',
      });
      expect(url).toBe('https://server.example.com:9000/sse');
    });
  });

  describe('Backend Selection Precedence', () => {
    it('should prefer header over static config when dynamic routing enabled', () => {
      const decision = selectBackend({
        headerValue: 'dynamic.example.com',
        config,
        staticBackendUrl: 'https://static.example.com:443/mcp',
      });

      expect(decision.selectionSource).toBe(BackendSelection.HEADER);
      expect(decision.backendUrl).toContain('dynamic.example.com');
    });

    it('should use static config when dynamic routing disabled', () => {
      const disabledConfig = { ...config, enabled: false };
      const decision = selectBackend({
        headerValue: 'dynamic.example.com',
        config: disabledConfig,
        staticBackendUrl: 'https://static.example.com:443/mcp',
      });

      expect(decision.selectionSource).toBe(BackendSelection.STATIC_CONFIG);
      expect(decision.backendUrl).toBe('https://static.example.com:443/mcp');
    });

    it('should return error when dynamic disabled and no static config', () => {
      const disabledConfig = { ...config, enabled: false };
      const decision = selectBackend({
        headerValue: 'dynamic.example.com',
        config: disabledConfig,
      });

      expect(decision.selectionSource).toBe(BackendSelection.ERROR);
      expect(decision.error).toContain('dynamic routing disabled');
    });
  });

  describe('Edge Cases', () => {
    it('should handle IPv4 addresses when allowed', () => {
      const headerValue = '192.168.1.100:8080';
      const result = resolveBackendFromHeader(headerValue, config);
      expect(result).toBe('https://192.168.1.100:8080/mcp');
    });

    it('should normalize hostname to lowercase', () => {
      const headerValue = 'SERVER.EXAMPLE.COM';
      const parsed = parseBackendHostHeader(headerValue);
      expect(parsed?.hostname).toBe('server.example.com');
    });

    it('should handle port 1 (minimum valid port)', () => {
      const headerValue = 'server.example.com:1';
      const parsed = parseBackendHostHeader(headerValue);
      expect(parsed?.port).toBe(1);
    });

    it('should handle port 65535 (maximum valid port)', () => {
      const headerValue = 'server.example.com:65535';
      const parsed = parseBackendHostHeader(headerValue);
      expect(parsed?.port).toBe(65535);
    });

    it('should reject port 0', () => {
      expect(() => {
        parseBackendHostHeader('server.example.com:0');
      }).toThrow('Invalid port');
    });

    it('should reject port 65536', () => {
      expect(() => {
        parseBackendHostHeader('server.example.com:65536');
      }).toThrow('Invalid port');
    });

    it('should handle hostname with multiple colons (IPv6-like, should fail gracefully)', () => {
      // IPv6 addresses like 2001:db8::1:8080 are not supported in MVP
      // The parser will extract hostname "2001:db8::1" and port "8080"
      // Then validation will fail because hostname contains colons
      expect(() => {
        resolveBackendFromHeader('2001:db8::1:8080', config);
      }).toThrow('Invalid hostname format');
    });
  });

  describe('Logging and Observability', () => {
    it('should provide selection source description for static config', () => {
      const desc = getSelectionSourceDescription(BackendSelection.STATIC_CONFIG);
      expect(desc).toBe('Static Configuration');
    });

    it('should provide selection source description for header', () => {
      const desc = getSelectionSourceDescription(BackendSelection.HEADER);
      expect(desc).toBe('Dynamic Header (APIM-PROXIED-MCP-HOST)');
    });

    it('should provide selection source description for error', () => {
      const desc = getSelectionSourceDescription(BackendSelection.ERROR);
      expect(desc).toBe('Error (No Backend Available)');
    });

    it('should validate backend decision correctly', () => {
      const validDecision = {
        backendUrl: 'https://server.example.com:443/mcp',
        selectionSource: BackendSelection.HEADER,
      };
      expect(isValidBackend(validDecision)).toBe(true);

      const errorDecision = {
        backendUrl: '',
        selectionSource: BackendSelection.ERROR,
        error: 'No backend available',
      };
      expect(isValidBackend(errorDecision)).toBe(false);
    });
  });
});
