import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { getLogger } from '../../common/logger';
import type { MCPResponse } from '../../mcp/validator';

export interface ProxyRequestBody {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export async function registerProxyRoutes(app: FastifyInstance): Promise<void> {
  const logger = getLogger();

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

        // Placeholder: Will be replaced with actual forwarding
        const response: MCPResponse = {
          jsonrpc: '2.0',
          id: body.id,
          result: {
            content: [{ type: 'text', text: 'OK' }],
          },
        };

        const latencyMs = Date.now() - startTime;
        return reply
          .header('X-Proxy-Latency-Ms', latencyMs.toString())
          .code(200)
          .send(response);
      } catch (error) {
        logger.error(`Proxy request failed for server: ${serverId}`, error as Error);
        return reply.code(500).send({
          jsonrpc: '2.0',
          id: (request.body as ProxyRequestBody)?.id || null,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error',
          },
        });
      }
    }
  );
}
