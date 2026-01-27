import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { SSEEvent, SSEConnection, SSEParseResult } from '../types/sse';
import { getLogger } from '../common/logger';

const logger = getLogger();

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
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done || this.connection.abortController?.signal.aborted) {
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
        logger.error('SSE parsing error', {
          serverId: this.connection.serverId,
          error: parseError.message,
        });
      }
    }

    // Extract JSON-RPC from buffered events
    let jsonrpc: unknown | undefined;
    if (!parseError && !timedOut && events.length > 0) {
      try {
        jsonrpc = this.extractJSONRPC(events);
      } catch (error) {
        parseError = {
          message: error instanceof Error ? error.message : String(error),
          eventData: events.map(e => e.data).join('\n'),
        };
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
  extractJSONRPC(events: SSEEvent[]): unknown {
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
      // Parse JSON-RPC message
      const jsonrpc = JSON.parse(dataPayload);
      
      // Validate it's a JSON-RPC message
      if (!jsonrpc || typeof jsonrpc !== 'object') {
        throw new Error('Invalid JSON-RPC message: not an object');
      }

      if (!('jsonrpc' in jsonrpc) || jsonrpc.jsonrpc !== '2.0') {
        throw new Error('Invalid JSON-RPC message: missing or invalid jsonrpc field');
      }

      return jsonrpc;
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
}
