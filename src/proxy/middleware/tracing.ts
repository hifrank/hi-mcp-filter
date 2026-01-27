import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getLogger } from '../../common/logger';
import { v4 as uuidv4 } from 'uuid';

export function setupTracingHeaders(app: FastifyInstance): void {
  const logger = getLogger();

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Generate or use existing trace ID
    const traceId = request.headers['x-trace-id'] as string || uuidv4();
    const spanId = uuidv4();

    // Attach to request
    request.id = traceId;
    (request as any).spanId = spanId;

    // Add response headers
    reply.header('x-trace-id', traceId);
    reply.header('x-span-id', spanId);
    reply.header('x-request-id', request.id);

    logger.debug('Request trace headers', { traceId, spanId });
  });

  logger.info('Tracing headers middleware registered');
}
