import { FastifyInstance } from 'fastify';
import { getMetrics } from '../../common/metrics';
import { getLogger } from '../../common/logger';

export function registerMetricsRoute(app: FastifyInstance): void {
  const logger = getLogger();

  app.get<{ Reply: unknown }>('/metrics', async (_request, reply) => {
    try {
      const metrics = getMetrics();

      const latencyCount = metrics.requestLatency.getCount();
      const requestTotal = metrics.requestCount.getValue();
      const filterTotal = metrics.filterCount.getValue();
      const transformTotal = metrics.transformCount.getValue();
      const pluginTotal = metrics.pluginCount.getValue();
      const errorTotal = metrics.errorCount.getValue();

      const prometheusMetrics = `# HELP proxy_request_latency_ms Request latency in milliseconds
# TYPE proxy_request_latency_ms histogram
    proxy_request_latency_ms_bucket{le="+Inf"} ${latencyCount}

# HELP proxy_request_total Total number of requests
# TYPE proxy_request_total counter
    proxy_request_total ${requestTotal}

# HELP proxy_filter_total Total number of filters executed
# TYPE proxy_filter_total counter
    proxy_filter_total ${filterTotal}

# HELP proxy_transform_total Total number of transformations executed
# TYPE proxy_transform_total counter
    proxy_transform_total ${transformTotal}

# HELP proxy_plugin_total Total number of plugins executed
# TYPE proxy_plugin_total counter
    proxy_plugin_total ${pluginTotal}

# HELP proxy_error_total Total number of errors
# TYPE proxy_error_total counter
    proxy_error_total ${errorTotal}
`;

      return reply.type('text/plain').send(prometheusMetrics);
    } catch (error) {
      logger.error('Error generating metrics', error as Error);
      return reply.status(500).send('Internal server error');
    }
  });

  logger.info('Metrics route registered');
}
