import { FastifyRequest } from 'fastify';
import { getLogger } from '../../common/logger';
import type { MCPResponse } from '../../mcp/validator';

export interface LogEntry extends Record<string, unknown> {
  timestamp: string;
  requestId: string;
  method: string;
  path: string;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
}

export function logRequestResponse(
  request: FastifyRequest,
  response: MCPResponse,
  latencyMs: number
): void {
  const logger = getLogger();

  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    requestId: String(request.id),
    method: request.method,
    path: request.url,
    latencyMs,
  };

  if (response.error) {
    logEntry.error = response.error.message;
  }

  logger.info('Request processed', logEntry);
}

export function logProxyRequest(request: FastifyRequest, serverId: string): void {
  const logger = getLogger();

  logger.debug('Proxy request', {
    requestId: request.id,
    serverId,
    method: request.method,
    path: request.url,
  });
}
