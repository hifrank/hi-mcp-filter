import { FastifyInstance } from 'fastify';
import { getLogger } from '../../common/logger';
import { ConfigHotReloadManager } from '../../config/hot-reload';

export function registerConfigManagementRoutes(
  app: FastifyInstance,
  reloadManager: ConfigHotReloadManager
): void {
  const logger = getLogger();

  // GET /config - Retrieve current configuration
  app.get<{ Reply: unknown }>('/config', async (request, reply) => {
    try {
      const config = reloadManager.getConfig();
      if (!config) {
        return reply.status(404).send({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32600, message: 'No configuration loaded' },
        });
      }

      return reply.status(200).send({
        jsonrpc: '2.0',
        id: request.id,
        result: config,
      });
    } catch (error) {
      logger.error('Error retrieving config', error as Error);
      return reply.status(500).send({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32603, message: 'Internal server error' },
      });
    }
  });

  // POST /config - Update configuration (triggers hot-reload)
  app.post<{ Body: unknown; Reply: unknown }>('/config', async (request, reply) => {
    try {
      const newConfig = request.body;
      const success = reloadManager.updateConfig(newConfig);

      if (!success) {
        return reply.status(400).send({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32602, message: 'Invalid configuration' },
        });
      }

      return reply.status(200).send({
        jsonrpc: '2.0',
        id: request.id,
        result: { success: true, message: 'Configuration updated' },
      });
    } catch (error) {
      logger.error('Error updating config', error as Error);
      return reply.status(500).send({
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32603, message: 'Internal server error' },
      });
    }
  });

  logger.info('Config management routes registered');
}
