import { FastifyInstance } from 'fastify';
import { getMetrics } from '../../common/metrics';
import { getLogger } from '../../common/logger';

export async function registerMetricsRoute(app: FastifyInstance): Promise<void> {
  const logger = getLogger();

  app.get<{ Reply: unknown }>('/metrics', async (_request, reply) => {
    try {
      const metrics = getMetrics();

      const prometheusMetrics = `# HELP proxy_request_latency_ms Request latency in milliseconds
# TYPE proxy_request_latency_ms histogram
proxy_request_latency_ms_bucket{le="+Inf"} ${(metrics.requestLatency as any)?.count || 0}

# HELP proxy_request_total Total number of requests
# TYPE proxy_request_total counter
proxy_request_total ${metrics.requestCount || 0}

# HELP proxy_filter_total Total number of filters executed
# TYPE proxy_filter_total counter
proxy_filter_total ${metrics.filterCount || 0}

# HELP proxy_transform_total Total number of transformations executed
# TYPE proxy_transform_total counter
proxy_transform_total ${metrics.transformCount || 0}

# HELP proxy_plugin_total Total number of plugins executed
# TYPE proxy_plugin_total counter
proxy_plugin_total ${metrics.pluginCount || 0}

# HELP proxy_error_total Total number of errors
# TYPE proxy_error_total counter
proxy_error_total ${metrics.errorCount || 0}
`;

      return reply.type('text/plain').send(prometheusMetrics);
    } catch (error) {
      logger.error('Error generating metrics', error as Error);
      return reply.status(500).send('Internal server error');
    }
  });

  logger.info('Metrics route registered');
}
