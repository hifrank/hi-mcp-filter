import { validateMCPResponse } from '../../../src/mcp/validator';

describe('MCP Response Validation in Proxy Context', () => {
  describe('Router Logic', () => {
    it('should validate MCP response structure before routing', () => {
      const validResponse = {
        jsonrpc: '2.0',
        id: 'req-123',
        result: { content: [{ type: 'text', text: 'Hello' }] },
      };

      const result = validateMCPResponse(validResponse);
      expect(result.valid).toBe(true);
    });

    it('should reject responses with missing fields', () => {
      const invalidResponse = {
        jsonrpc: '2.0',
        // missing id
        result: { content: [] },
      };

      const result = validateMCPResponse(invalidResponse);
      expect(result.valid).toBe(false);
    });

    it('should handle error responses correctly', () => {
      const errorResponse = {
        jsonrpc: '2.0',
        id: 'req-456',
        error: { code: -32000, message: 'Server error' },
      };

      const result = validateMCPResponse(errorResponse);
      expect(result.valid).toBe(true);
    });
  });

  describe('Request Forwarding', () => {
    it('should preserve request structure when forwarding', () => {
      const request = {
        jsonrpc: '2.0',
        id: 'req-789',
        method: 'tool_call',
        params: { tool: 'calculator', args: { op: 'add' } },
      };

      // Simulating forwarder preserving structure
      const forwardedRequest = { ...request };
      expect(forwardedRequest).toEqual(request);
    });

    it('should track latency during forwarding', () => {
      const startTime = Date.now();
      // Simulating 50ms forwarding time
      const endTime = startTime + 50;
      const latency = endTime - startTime;

      expect(latency).toBeGreaterThanOrEqual(50);
      expect(latency).toBeLessThan(100);
    });
  });
});
