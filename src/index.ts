import fastify from 'fastify';
import { getLogger } from './common/logger';
import { ConfigHotReloadManager } from './config/hot-reload';
import { setupTracingHeaders } from './proxy/middleware/tracing';
import { registerMetricsRoute } from './proxy/routes/metrics';
import { registerConfigManagementRoutes } from './proxy/routes/config';
import { registerProxyRoutes } from './proxy/routes/proxy';
import { GracefulShutdown } from './proxy/shutdown';

const logger = getLogger();

async function main(): Promise<void> {
  try {
    // Load configuration
    const configFile = process.env.CONFIG_FILE || './config/default.json';
    const reloadManager = new ConfigHotReloadManager(configFile);
    reloadManager.initialize();

    // Create Fastify app
    const app = fastify({
      logger: false, // Use Pino logger instead
      requestIdHeader: 'x-request-id',
      disableRequestLogging: false,
    });

    // Setup middleware
    setupTracingHeaders(app);

    // Setup health endpoint
    app.get('/health', () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }));

    // Setup management routes
    registerMetricsRoute(app);
    registerConfigManagementRoutes(app, reloadManager);
    registerProxyRoutes(app, reloadManager);

    // Setup graceful shutdown
    const shutdown = new GracefulShutdown();
    shutdown.registerSignalHandlers(app);

    // Start server
    const port = parseInt(process.env.PORT || '8080', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });

    logger.info('MCP Proxy Server started', {
      port,
      host,
      nodeEnv: process.env.NODE_ENV || 'development',
      configFile,
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

void main();
