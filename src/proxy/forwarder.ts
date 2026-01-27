import { getLogger } from '../common/logger';
import { getMetrics } from '../common/metrics';
import { BackendError, TimeoutError } from '../common/errors';
import type { MCPResponse } from '../mcp/validator';

export interface ForwardRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export class RequestForwarder {
  private logger = getLogger();
  private metrics = getMetrics();

  async forwardRequest(
    backendUrl: string,
    request: ForwardRequest,
    timeout: number
  ): Promise<MCPResponse> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Forwarding request to ${backendUrl}`, { requestId: request.id });

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new BackendError(`Backend returned status ${response.status}`);
        }

        const data = (await response.json()) as unknown as MCPResponse;
        const latency = Date.now() - startTime;

        this.logger.debug(`Response received from backend`, {
          requestId: request.id,
          latencyMs: latency,
        });

        return data;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          throw new TimeoutError(`Request timeout after ${timeout}ms to ${backendUrl}`);
        }

        throw error;
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      this.metrics.errorCount.inc();

      if (error instanceof BackendError || error instanceof TimeoutError) {
        throw error;
      }

      throw new BackendError(
        `Failed to forward request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error, latencyMs: latency }
      );
    }
  }

  async forwardToMultipleServers(
    serverUrls: string[],
    request: ForwardRequest,
    timeout: number
  ): Promise<MCPResponse[]> {
    const results = await Promise.allSettled(
      serverUrls.map((url) => this.forwardRequest(url, request, timeout))
    );

    return results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<MCPResponse>).value);
  }
}
