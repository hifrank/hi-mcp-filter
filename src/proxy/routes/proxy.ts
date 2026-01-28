/* eslint-disable @typescript-eslint/no-floating-promises */
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { getLogger } from '../../common/logger';
import type { MCPResponse } from '../../mcp/validator';
import type { ConfigHotReloadManager } from '../../config/hot-reload';
import { RequestForwarder } from '../forwarder';
import { getTransportForServer } from '../transport';

export interface ProxyRequestBody {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export function registerProxyRoutes(
  app: FastifyInstance,
  reloadManager: ConfigHotReloadManager
): void {
  const logger = getLogger();
  const forwarder = new RequestForwarder();

  app.post<{ Params: { serverId: string }; Body: ProxyRequestBody }>(
    '/proxy/:serverId',
    async (request: FastifyRequest<{ Params: { serverId: string } }>, reply: FastifyReply) => {
      const startTime = Date.now();
      const { serverId } = request.params;

      try {
        const body = request.body as ProxyRequestBody;

        logger.debug(`Proxy request for server: ${serverId}`, {
          requestId: body.id,
          method: body.method,
        });

        // Get server config
        const config = reloadManager.getConfig();
        const server = config?.mcpServers?.find((s: { id: string }) => s.id === serverId);

        if (!server) {
          return reply.code(404).send({
            jsonrpc: '2.0',
            id: body.id,
            error: {
              code: -32001,
              message: `Server '${serverId}' not found`,
            },
          });
        }

        // Determine transport mode
        const transportMode = getTransportForServer(server);
        let response: MCPResponse;
        let actualTransport: 'http' | 'sse';

        // Route to appropriate forwarder based on transport
        if (transportMode === 'sse') {
          // Explicit SSE transport
          actualTransport = 'sse';
          const sseEventFilter = server.sseOptions?.sseEventFilter || ['message'];
          const sseBufferSize = server.sseOptions?.sseBufferSize || 10;

          response = await forwarder.forwardSSE(
            server.url,
            serverId,
            body,
            server.timeout || 30000,
            sseEventFilter,
            sseBufferSize
          );
        } else if (transportMode === 'http') {
          // Explicit HTTP transport
          actualTransport = 'http';
          response = await forwarder.forwardRequest(server.url, body, server.timeout || 30000);
        } else {
          // Auto-detection mode - try HTTP first, fall back to SSE if needed
          // For MVP, we'll use HTTP by default in auto mode
          // Full auto-detection (checking Content-Type) will be added in next iteration
          actualTransport = 'http';
          response = await forwarder.forwardRequest(server.url, body, server.timeout || 30000);
        }

        const headers: Record<string, string> = {
          'X-Proxy-Latency-Ms': (Date.now() - startTime).toString(),
          'X-Proxy-Filtered': 'false',
          'X-Proxy-Transformed': 'false',
          'X-Proxy-Transport': actualTransport,
        };

        for (const [k, v] of Object.entries(headers)) {
          reply.header(k, v);
        }
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        void reply.send(response);
        return;
      } catch (error) {
        const latencyMs = Date.now() - startTime;

        logger.error(
          `Proxy request failed for server: ${serverId} after ${latencyMs}ms`,
          error as Error
        );

        // Return 502 for SSE parsing errors, 504 for timeouts, 500 for other errors
        let statusCode = 500;
        if (error instanceof Error) {
          if (error.message.includes('timeout')) {
            statusCode = 504;
          } else if (
            error.message.includes('SSE stream error') ||
            error.message.includes('parsing')
          ) {
            statusCode = 502;
          }
        }

        return reply.code(statusCode).send({
          jsonrpc: '2.0',
          id: (request.body as ProxyRequestBody)?.id || null,
          error: {
            code: statusCode === 504 ? -32000 : -32603,
            message: error instanceof Error ? error.message : 'Internal error',
          },
        });
      }
    }
  );

  logger.info('Proxy routes registered');
}
