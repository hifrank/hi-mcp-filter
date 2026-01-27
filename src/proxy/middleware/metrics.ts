import { getMetrics } from '../../common/metrics';

export function recordLatency(startTimeMs: number): number {
  const latency = Date.now() - startTimeMs;
  const metrics = getMetrics();
  metrics.requestLatency.observe(latency);
  return latency;
}

export function addLatencyHeader(headers: Record<string, string>, latencyMs: number): void {
  headers['X-Proxy-Latency-Ms'] = String(latencyMs);
}

export function trackRequestMetrics(_request: unknown): void {
  const metrics = getMetrics();
  metrics.requestCount.inc();
}
