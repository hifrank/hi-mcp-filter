/**
 * T039-T042: Transport detection unit tests
 */

import { detectTransport, getTransportForServer, shouldUseSSE } from '../../src/proxy/transport';
import { MCPServer } from '../../src/config/loader';

describe('Transport Detection', () => {
  describe('T039: detectTransport with text/event-stream header', () => {
    it('should detect SSE from Content-Type header', () => {
      const headers = new Headers({ 'Content-Type': 'text/event-stream' });
      const transport = detectTransport(headers);
      expect(transport).toBe('sse');
    });

    it('should detect SSE with charset parameter', () => {
      const headers = new Headers({ 'Content-Type': 'text/event-stream; charset=utf-8' });
      const transport = detectTransport(headers);
      expect(transport).toBe('sse');
    });

    it('should be case-insensitive for header values', () => {
      const headers = new Headers({ 'content-type': 'TEXT/EVENT-STREAM' });
      const transport = detectTransport(headers);
      expect(transport).toBe('sse');
    });
  });

  describe('T040: detectTransport with application/json header', () => {
    it('should detect HTTP from application/json', () => {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      const transport = detectTransport(headers);
      expect(transport).toBe('http');
    });

    it('should detect HTTP from application/json with charset', () => {
      const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
      const transport = detectTransport(headers);
      expect(transport).toBe('http');
    });

    it('should default to HTTP when no Content-Type header', () => {
      const headers = new Headers();
      const transport = detectTransport(headers);
      expect(transport).toBe('http');
    });

    it('should default to HTTP for unknown Content-Type', () => {
      const headers = new Headers({ 'Content-Type': 'text/html' });
      const transport = detectTransport(headers);
      expect(transport).toBe('http');
    });
  });

  describe('T041: getTransportForServer with explicit transport config', () => {
    it('should return configured transport when set to "sse"', () => {
      const server: MCPServer = {
        id: 'test-sse',
        url: 'http://example.com',
        transport: 'sse',
      };
      const transport = getTransportForServer(server);
      expect(transport).toBe('sse');
    });

    it('should return configured transport when set to "http"', () => {
      const server: MCPServer = {
        id: 'test-http',
        url: 'http://example.com',
        transport: 'http',
      };
      const transport = getTransportForServer(server);
      expect(transport).toBe('http');
    });

    it('should return "auto" when transport is set to "auto"', () => {
      const server: MCPServer = {
        id: 'test-auto',
        url: 'http://example.com',
        transport: 'auto',
      };
      const transport = getTransportForServer(server);
      expect(transport).toBe('auto');
    });
  });

  describe('T042: getTransportForServer with auto transport config', () => {
    it('should default to "auto" when transport is not configured', () => {
      const server: MCPServer = {
        id: 'test-default',
        url: 'http://example.com',
      };
      const transport = getTransportForServer(server);
      expect(transport).toBe('auto');
    });

    it('should handle undefined transport field', () => {
      const server: MCPServer = {
        id: 'test-undefined',
        url: 'http://example.com',
        transport: undefined,
      };
      const transport = getTransportForServer(server);
      expect(transport).toBe('auto');
    });
  });

  describe('shouldUseSSE helper', () => {
    it('should return true for explicit SSE transport', () => {
      const server: MCPServer = {
        id: 'test',
        url: 'http://example.com',
        transport: 'sse',
      };
      const headers = new Headers();
      expect(shouldUseSSE(server, headers)).toBe(true);
    });

    it('should return false for explicit HTTP transport', () => {
      const server: MCPServer = {
        id: 'test',
        url: 'http://example.com',
        transport: 'http',
      };
      const headers = new Headers({ 'Content-Type': 'text/event-stream' });
      expect(shouldUseSSE(server, headers)).toBe(false);
    });

    it('should auto-detect SSE from headers when transport is auto', () => {
      const server: MCPServer = {
        id: 'test',
        url: 'http://example.com',
        transport: 'auto',
      };
      const headers = new Headers({ 'Content-Type': 'text/event-stream' });
      expect(shouldUseSSE(server, headers)).toBe(true);
    });

    it('should auto-detect HTTP from headers when transport is auto', () => {
      const server: MCPServer = {
        id: 'test',
        url: 'http://example.com',
        transport: 'auto',
      };
      const headers = new Headers({ 'Content-Type': 'application/json' });
      expect(shouldUseSSE(server, headers)).toBe(false);
    });

    it('should default to auto-detection when transport is undefined', () => {
      const server: MCPServer = {
        id: 'test',
        url: 'http://example.com',
      };
      const headers = new Headers({ 'Content-Type': 'text/event-stream' });
      expect(shouldUseSSE(server, headers)).toBe(true);
    });
  });
});
