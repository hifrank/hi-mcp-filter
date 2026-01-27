import { getLogger } from '../common/logger';

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  details?: Record<string, unknown>;
}

export function createHealthCheck(): HealthCheckResponse {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    details: {
      memory: process.memoryUsage(),
    },
  };
}

export function performHealthCheck(): HealthCheckResponse {
  const logger = getLogger();

  try {
    const health = createHealthCheck();
    logger.debug('Health check completed', health);
    return health;
  } catch (error) {
    logger.error('Health check failed', error as Error);
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    };
  }
}
