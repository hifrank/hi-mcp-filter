import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getLogger } from '../common/logger';
import { getMetrics } from '../common/metrics';

export interface ProxyServerConfig {
  port: number;
  host: string;
  requestTimeout: number;
}

export class ProxyServer {
  private app: FastifyInstance;
  private logger = getLogger();
  private metrics = getMetrics();
  private config: ProxyServerConfig;

  constructor(config: ProxyServerConfig) {
    this.config = config;
    this.app = Fastify({
      logger: false,
      requestTimeout: config.requestTimeout,
    });
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.code(200).send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    });

    // Proxy endpoint
    this.app.post<{ Params: { serverId: string } }>(
      '/proxy/:serverId',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const startTime = Date.now();
        const params = request.params as { serverId: string };
        const { serverId } = params;

        try {
          this.logger.debug(`Proxy request received for server: ${serverId}`);
          this.metrics.requestCount.inc();

          // Extract body
          const body = request.body as unknown;

          // Record latency
          const latency = Date.now() - startTime;
          this.metrics.requestLatency.observe(latency);

          // For now, echo back the request (will be replaced with actual forwarding)
          return reply.code(200).send({
            serverId,
            received: body,
            latencyMs: latency,
          });
        } catch (error) {
          this.logger.error('Proxy request failed', error as Error);
          this.metrics.errorCount.inc();
          return reply
            .code(500)
            .send({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }
    );
  }

  async start(): Promise<void> {
    try {
      await this.app.listen({ port: this.config.port, host: this.config.host });
      this.logger.info(`Proxy server listening on ${this.config.host}:${this.config.port}`);
    } catch (error) {
      this.logger.error('Failed to start proxy server', error as Error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    await this.app.close();
    this.logger.info('Proxy server stopped');
  }

  getInstance(): FastifyInstance {
    return this.app;
  }
}
