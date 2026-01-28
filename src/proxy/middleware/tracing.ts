import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getLogger } from '../../common/logger';
import { v4 as uuidv4 } from 'uuid';

type TracedRequest = FastifyRequest & { spanId?: string };

export function setupTracingHeaders(app: FastifyInstance): void {
  const logger = getLogger();

  app.addHook('preHandler', (request: FastifyRequest, reply: FastifyReply, done) => {
    // Generate or use existing trace ID
    const traceId = (request.headers['x-trace-id'] as string) || uuidv4();
    const spanId = uuidv4();

    const tracedRequest = request as TracedRequest;

    // Attach to request
    tracedRequest.id = traceId;
    tracedRequest.spanId = spanId;

    // Add response headers
    void reply.header('x-trace-id', traceId);
    void reply.header('x-span-id', spanId);
    void reply.header('x-request-id', request.id);

    logger.debug('Request trace headers', { traceId, spanId });
    done();
  });

  logger.info('Tracing headers middleware registered');
}
