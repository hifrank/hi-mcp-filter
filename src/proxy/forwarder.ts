import { getLogger } from '../common/logger';
import { getMetrics } from '../common/metrics';
import { BackendError, TimeoutError } from '../common/errors';
import type { MCPResponse } from '../mcp/validator';
import { SSEParser } from './sse-parser';

const contentTypeHeader = 'Content-Type';

export interface ForwardRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export class RequestForwarder {
  private logger = getLogger();
  private metrics = getMetrics();

  /**
   * Forward request to HTTP JSON-RPC backend
   */
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
      timeoutId.unref();

      try {
        const jsonHeaders: Record<string, string> = { [contentTypeHeader]: 'application/json' };

        const response = await fetch(backendUrl, {
          method: 'POST',
          headers: jsonHeaders,
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new BackendError(`Backend returned status ${response.status}`);
        }
        const data = (await response.json()) as MCPResponse;
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

  /**
   * Forward request to SSE-based backend
   * Parses SSE stream and extracts JSON-RPC response
   */
  async forwardSSE(
    backendUrl: string,
    serverId: string,
    request: ForwardRequest,
    timeout: number,
    sseEventFilter: string[] = ['message'],
    sseBufferSize: number = 10
  ): Promise<MCPResponse> {
    const startTime = Date.now();

    try {
      this.logger.info('Forwarding request to SSE backend', {
        serverId,
        requestId: request.id,
        backendUrl,
      });

      // Send POST request (SSE servers expect POST with JSON-RPC payload)
      const jsonHeaders: Record<string, string> = { [contentTypeHeader]: 'application/json' };

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new BackendError(`Backend SSE server returned status ${response.status}`);
      }

      // Parse SSE stream
      const parser = new SSEParser(serverId, timeout, sseEventFilter, sseBufferSize);
      const result = await parser.parseSSEStream(response);

      const latency = Date.now() - startTime;

      // Handle timeout
      if (result.timedOut) {
        this.logger.error('SSE stream timeout', {
          serverId,
          requestId: request.id,
          timeout,
          duration: result.duration,
        });
        this.metrics.sseTimeouts.inc();
        throw new TimeoutError(`SSE stream timeout after ${timeout}ms`);
      }

      // Handle parsing errors
      if (result.error) {
        this.logger.error('Backend SSE stream error', {
          serverId,
          requestId: request.id,
          error: result.error.message,
          eventData: result.error.eventData,
        });
        throw new BackendError(`Backend SSE stream error: ${result.error.message}`);
      }

      // Validate we got a JSON-RPC response
      if (!result.jsonrpc) {
        throw new BackendError('No JSON-RPC message extracted from SSE stream');
      }

      this.logger.info('SSE response received from backend', {
        serverId,
        requestId: request.id,
        latencyMs: latency,
        sseParsingMs: result.duration,
        eventCount: result.events.length,
      });

      return result.jsonrpc;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.metrics.errorCount.inc();

      if (error instanceof BackendError || error instanceof TimeoutError) {
        throw error;
      }

      throw new BackendError(
        `Failed to forward SSE request: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<MCPResponse> => r.status === 'fulfilled'
    );
    return fulfilled.map((r) => r.value);
  }
}

// Convenience function for single request forwarding
const forwarder = new RequestForwarder();
export async function forwardRequest(
  backendUrl: string,
  request: ForwardRequest,
  timeout: number
): Promise<MCPResponse> {
  return forwarder.forwardRequest(backendUrl, request, timeout);
}
