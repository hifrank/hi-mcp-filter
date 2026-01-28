/* eslint-disable @typescript-eslint/no-redundant-type-constituents, @typescript-eslint/no-unsafe-assignment */
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { isMCPResponse, type MCPResponse } from '../mcp/validator';
import { SSEEvent, SSEConnection, SSEParseResult } from '../types/sse';
import { getLogger } from '../common/logger';
import { getMetrics } from '../common/metrics';

const logger = getLogger();
const metrics = getMetrics();

/**
 * SSEParser - Parse Server-Sent Events streams and extract JSON-RPC messages
 * 
 * Uses the eventsource-parser library to handle SSE format parsing,
 * buffers events until close event or timeout, and extracts JSON-RPC payloads.
 */
export class SSEParser {
  private connection: SSEConnection;
  private eventFilter: string[];
  private bufferSize: number;

  constructor(
    serverId: string,
    timeout: number = 30000,
    eventFilter: string[] = ['message'],
    bufferSize: number = 10
  ) {
    this.connection = {
      state: 'CONNECTING',
      serverId,
      events: [],
      startTime: Date.now(),
      timeout,
      abortController: new AbortController(),
    };
    this.eventFilter = eventFilter;
    this.bufferSize = bufferSize;
    
    // Enforce buffer size limit
    if (bufferSize < 1 || bufferSize > 1000) {
      throw new Error(`Invalid sseBufferSize: ${bufferSize}. Must be between 1 and 1000.`);
    }
  }

  /**
   * Parse SSE stream from response body
   * Buffers events until close event or timeout
   */
  async parseSSEStream(response: Response): Promise<SSEParseResult> {
    const startTime = Date.now();
    const events: SSEEvent[] = [];
    let parseError: { message: string; eventData?: string; lineNumber?: number } | undefined;
    let timedOut = false;
    let parseErrorRecorded = false;

    const recordParseError = (): void => {
      if (!parseErrorRecorded) {
        metrics.sseParseErrors.inc();
        parseErrorRecorded = true;
      }
    };

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      this.connection.state = 'CONNECTED';
      
      // Set up timeout that cancels the reader to unblock the loop
      const timeoutId = setTimeout(() => {
        timedOut = true;
        this.connection.abortController?.abort();
        if (reader) {
          // Cancel the reader so the pending read resolves immediately
          reader.cancel().catch(() => {/* ignore */});
        }
        logger.warn('SSE stream timeout', {
          serverId: this.connection.serverId,
          duration: Date.now() - startTime,
          timeout: this.connection.timeout,
        });
      }, this.connection.timeout);

      // Create SSE parser with callback
      const parser = createParser({
        onEvent: (event: EventSourceMessage) => {
          metrics.sseEventsParsed.inc();
          const sseEvent: SSEEvent = {
            type: 'event',
            event: event.event || 'message',
            data: event.data,
            id: event.id,
          };

          // Close event signals end of stream - process BEFORE filtering
          const isCloseEvent = sseEvent.event === 'close';
          if (isCloseEvent) {
            clearTimeout(timeoutId);
            this.connection.abortController?.abort();
            if (reader) {
              reader.cancel().catch(() => {/* ignore */});
            }
          }

          // Filter events by type
          if (this.eventFilter.includes(sseEvent.event)) {
            events.push(sseEvent);
            this.connection.events.push(sseEvent);
            
            // Enforce buffer size limit - keep only last N events
            if (events.length > this.bufferSize) {
              events.shift();
            }
            if (this.connection.events.length > this.bufferSize) {
              this.connection.events.shift();
            }
            
            logger.debug('SSE event received', {
              serverId: this.connection.serverId,
              eventType: sseEvent.event,
              eventId: sseEvent.id,
            });
          }
        },
      });

      // Read response body as stream
      reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      
      let finished = false;
      while (!finished) {
        const { done, value } = await reader.read();
        if (done || this.connection.abortController?.signal.aborted) {
          finished = true;
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        parser.feed(chunk);
      }

      clearTimeout(timeoutId);
      this.connection.state = 'CLOSED';

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        timedOut = true;
      } else {
        parseError = {
          message: error instanceof Error ? error.message : String(error),
        };
        recordParseError();
        logger.error('SSE parsing error', {
          serverId: this.connection.serverId,
          error: parseError.message,
        });
      }
    }

    // Extract JSON-RPC from buffered events
    let jsonrpc: MCPResponse | undefined;
    if (!parseError && !timedOut && events.length > 0) {
      try {
        jsonrpc = this.extractJSONRPC(events);
      } catch (error) {
        parseError = {
          message: error instanceof Error ? error.message : String(error),
          eventData: events.map(e => e.data).join('\n'),
        };
        recordParseError();
      }
    }

    const duration = Date.now() - startTime;

    return {
      jsonrpc,
      events,
      error: parseError,
      timedOut,
      duration,
    };
  }

  /**
   * Extract JSON-RPC message from SSE events
   * Handles multi-line data fields and concatenates them
   */
  extractJSONRPC(events: SSEEvent[]): MCPResponse {
    // Find message events (ignore close, error, etc.)
    const messageEvents = events.filter(e => e.event === 'message');
    
    if (messageEvents.length === 0) {
      throw new Error('No message events found in SSE stream');
    }

    // For single-message responses, parse the first message event
    // For multi-message streams, concatenate all data fields
    const dataPayload = messageEvents
      .map(e => e.data)
      .filter(d => d && d.trim().length > 0)
      .join('\n');

    if (!dataPayload) {
      throw new Error('Empty data payload in SSE stream');
    }

    try {
      const parsed = this.parseUnknownJson(dataPayload);
      if (!isMCPResponse(parsed)) {
        throw new Error('Invalid JSON-RPC message: schema validation failed');
      }
      return parsed;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in SSE data field: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): SSEConnection {
    return { ...this.connection };
  }

  /**
   * Abort the SSE connection
   */
  abort(): void {
    this.connection.abortController?.abort();
    this.connection.state = 'CLOSING';
    logger.info('SSE connection aborted', {
      serverId: this.connection.serverId,
    });
  }

  private parseUnknownJson(payload: string): unknown {
    // Cast JSON.parse result to unknown to avoid any-based assignments
    return JSON.parse(payload) as unknown;
  }
}
