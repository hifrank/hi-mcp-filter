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
      const sseEventsParsedTotal = metrics.sseEventsParsed.getValue();
      const sseParseErrorsTotal = metrics.sseParseErrors.getValue();
      const sseTimeoutsTotal = metrics.sseTimeouts.getValue();

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

# HELP sse_events_parsed_total Total number of SSE events parsed
# TYPE sse_events_parsed_total counter
  sse_events_parsed_total ${sseEventsParsedTotal}

# HELP sse_parse_errors_total Total number of SSE parse errors
# TYPE sse_parse_errors_total counter
  sse_parse_errors_total ${sseParseErrorsTotal}

# HELP sse_timeouts_total Total number of SSE timeouts
# TYPE sse_timeouts_total counter
  sse_timeouts_total ${sseTimeoutsTotal}
`;

      return reply.type('text/plain').send(prometheusMetrics);
    } catch (error) {
      logger.error('Error generating metrics', error as Error);
      return reply.status(500).send('Internal server error');
    }
  });

  logger.info('Metrics route registered');
}
