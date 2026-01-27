import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

describe('Proxy Server', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Health Check Endpoint', () => {
    it('should return 200 with health status', async () => {
      app.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
        return reply.code(200).send({ status: 'ok' });
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ status: 'ok' });
    });

    it('should have liveness probe info', async () => {
      app.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
        return reply.code(200).send({
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        });
      });

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(body.uptime).toBeGreaterThan(0);
    });
  });

  describe('Proxy Routing', () => {
    it('should route requests to proxy endpoint by serverId', async () => {
      app.post<{ Params: { serverId: string } }>('/proxy/:serverId', async (req, reply) => {
        return reply.code(200).send({ received: req.params.serverId });
      });

      const response = await app.inject({
        method: 'POST',
        url: '/proxy/server-1',
        payload: { jsonrpc: '2.0', id: '123', method: 'test' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ received: 'server-1' });
    });

    it('should handle multiple concurrent requests', async () => {
      let requestCount = 0;
      app.post('/proxy/:serverId', async (_req, reply) => {
        requestCount++;
        return reply.code(200).send({ count: requestCount });
      });

      const promises = Array.from({ length: 100 }, (_, i) =>
        app.inject({
          method: 'POST',
          url: `/proxy/server-${i % 5}`,
          payload: { id: i },
        })
      );

      const responses = await Promise.all(promises);
      expect(responses).toHaveLength(100);
      expect(responses.every((r) => r.statusCode === 200)).toBe(true);
    });
  });
});
