import { validateMCPResponse, isMCPResponse, type MCPResponse } from '../../../src/mcp/validator';
import mcpResponses from '../../fixtures/mcp-responses.json';

describe('MCP Validator', () => {
  describe('validateMCPResponse', () => {
    it('should validate valid MCP response with result', () => {
      const response = mcpResponses[0];
      const result = validateMCPResponse(response);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate valid MCP response with error', () => {
      const response = mcpResponses[2];
      const result = validateMCPResponse(response);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject response without jsonrpc field', () => {
      const invalid = { id: '123', result: {} };
      const result = validateMCPResponse(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject response with invalid jsonrpc version', () => {
      const invalid = { jsonrpc: '1.0', id: '123', result: {} };
      const result = validateMCPResponse(invalid);

      expect(result.valid).toBe(false);
    });

    it('should reject response without id field', () => {
      const invalid = { jsonrpc: '2.0', result: {} };
      const result = validateMCPResponse(invalid);

      expect(result.valid).toBe(false);
    });

    it('should reject response with both result and error', () => {
      const invalid = { jsonrpc: '2.0', id: '123', result: {}, error: { code: -1, message: 'error' } };
      const result = validateMCPResponse(invalid);

      expect(result.valid).toBe(false);
    });

    it('should reject response with neither result nor error', () => {
      const invalid = { jsonrpc: '2.0', id: '123' };
      const result = validateMCPResponse(invalid);

      expect(result.valid).toBe(false);
    });
  });

  describe('isMCPResponse', () => {
    it('should identify valid MCP response', () => {
      const response = mcpResponses[0];
      expect(isMCPResponse(response)).toBe(true);
    });

    it('should reject invalid response', () => {
      const invalid = { id: '123' };
      expect(isMCPResponse(invalid)).toBe(false);
    });

    it('should work as type guard', () => {
      const data: unknown = mcpResponses[0];

      if (isMCPResponse(data)) {
        const response: MCPResponse = data;
        expect(response.jsonrpc).toBe('2.0');
      } else {
        fail('Should be valid MCP response');
      }
    });
  });
});
