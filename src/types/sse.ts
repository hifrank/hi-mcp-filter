/**
 * SSE Transport Type Definitions
 * 
 * Defines types for Server-Sent Events (SSE) transport support in the MCP proxy.
 * These types enable parsing SSE streams from MCP servers and extracting JSON-RPC messages.
 */

/**
 * Represents a single parsed Server-Sent Event
 */
export interface SSEEvent {
  /**
   * Event type classification
   */
  type: 'event' | 'comment' | 'id' | 'retry';
  
  /**
   * Event name (e.g., "message", "close", "error")
   * Defaults to "message" if not specified in SSE stream
   */
  event: string;
  
  /**
   * Event data payload (may be multi-line JSON)
   * For "message" events, this contains the JSON-RPC message
   */
  data: string;
  
  /**
   * Optional event ID for reconnection support
   */
  id?: string;
  
  /**
   * Optional reconnection retry interval in milliseconds
   */
  retry?: number;
}

/**
 * Represents an active SSE connection state
 */
export interface SSEConnection {
  /**
   * Connection lifecycle state
   */
  state: 'CONNECTING' | 'CONNECTED' | 'CLOSING' | 'CLOSED';
  
  /**
   * MCP server ID this connection is for
   */
  serverId: string;
  
  /**
   * Buffered events (waiting for close event or timeout)
   */
  events: SSEEvent[];
  
  /**
   * Connection start timestamp
   */
  startTime: number;
  
  /**
   * Timeout duration in milliseconds
   */
  timeout: number;
  
  /**
   * AbortController for timeout enforcement
   */
  abortController?: AbortController;
}

/**
 * Configuration options for SSE transport behavior
 */
export interface SSETransportConfig {
  /**
   * Transport mode selection
   * - "http": Force HTTP JSON-RPC transport
   * - "sse": Force Server-Sent Events transport
   * - "auto": Auto-detect based on Content-Type header
   */
  transport: 'http' | 'sse' | 'auto';
  
  /**
   * Event types to process (default: ["message"])
   * Only events matching these types will be parsed for JSON-RPC messages
   */
  sseEventFilter?: string[];
  
  /**
   * Maximum number of SSE events to buffer before processing
   * Min: 1, Max: 1000, Default: 10
   * Prevents memory exhaustion on large streams
   */
  sseBufferSize?: number;
  
  /**
   * (P3) Enable pass-through SSE streaming mode
   * If true, stream SSE events to client instead of buffering and converting to JSON
   * Default: false
   */
  sseStreamingMode?: boolean;
}

/**
 * Result of parsing an SSE stream
 */
export interface SSEParseResult {
  /**
   * Extracted JSON-RPC message (if successfully parsed)
   */
  jsonrpc?: unknown;
  
  /**
   * All events received (for debugging/logging)
   */
  events: SSEEvent[];
  
  /**
   * Parsing error if occurred
   */
  error?: {
    message: string;
    eventData?: string;
    lineNumber?: number;
  };
  
  /**
   * Whether the stream timed out
   */
  timedOut: boolean;
  
  /**
   * Total parsing duration in milliseconds
   */
  duration: number;
}
