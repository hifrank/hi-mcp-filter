/**
 * Transport Detection Module
 * 
 * Determines whether to use HTTP or SSE transport for MCP backend communication
 * based on configuration or response Content-Type header.
 */

import type { MCPServer } from '../config/loader';

/**
 * Detect transport type from HTTP headers
 * Used when transport is set to "auto"
 */
export function detectTransport(headers: Headers): 'http' | 'sse' {
  const contentType = headers.get('content-type');
  
  if (!contentType) {
    // Default to HTTP if no Content-Type header
    return 'http';
  }

  // SSE uses text/event-stream (case-insensitive)
  if (contentType.toLowerCase().includes('text/event-stream')) {
    return 'sse';
  }

  // JSON indicates HTTP JSON-RPC
  if (contentType.toLowerCase().includes('application/json')) {
    return 'http';
  }

  // Default to HTTP for unknown content types
  return 'http';
}

/**
 * Get configured transport type for a server
 * Returns the explicit transport setting or "auto" for detection
 */
export function getTransportForServer(server: MCPServer): 'http' | 'sse' | 'auto' {
  return server.transport || 'auto';
}

/**
 * Determine if server should use SSE transport
 * Checks explicit config first, uses headers for auto-detection
 */
export function shouldUseSSE(server: MCPServer, headers: Headers): boolean {
  const transport = getTransportForServer(server);
  
  if (transport === 'sse') {
    return true;
  }
  
  if (transport === 'http') {
    return false;
  }
  
  // "auto" - detect from headers
  return detectTransport(headers) === 'sse';
}
