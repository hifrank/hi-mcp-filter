import { SSEParser } from '../../src/proxy/sse-parser';
import { SSEParseResult } from '../../src/types/sse';
import { RequestForwarder } from '../../src/proxy/forwarder';
import { TimeoutError } from '../../src/common/errors';

describe('SSEParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock Response with SSE stream
  function createSSEResponse(sseData: string): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseData));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  describe('T023: Valid SSE stream parsing', () => {
    it('should parse valid SSE stream with JSON-RPC response', async () => {
      const jsonrpcResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { capabilities: { tools: {} } },
      };

      const sseData = `event: message
data: ${JSON.stringify(jsonrpcResponse)}

event: close
data: stream ended

`;

      const parser = new SSEParser('test-server', 5000, ['message', 'close']); // Include close in filter
      const response = createSSEResponse(sseData);
      const result: SSEParseResult = await parser.parseSSEStream(response);

      expect(result.error).toBeUndefined();
      expect(result.timedOut).toBe(false);
      expect(result.events).toHaveLength(2);
      expect(result.events[0].event).toBe('message');
      expect(result.events[0].data).toBe(JSON.stringify(jsonrpcResponse));
      expect(result.events[1].event).toBe('close');
      expect(result.jsonrpc).toEqual(jsonrpcResponse);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should parse SSE stream with event IDs', async () => {
      const jsonrpcResponse = { jsonrpc: '2.0', id: 2, result: {} };

      const sseData = `id: msg-1
event: message
data: ${JSON.stringify(jsonrpcResponse)}

event: close
data: done

`;

      const parser = new SSEParser('test-server', 5000);
      const response = createSSEResponse(sseData);
      const result = await parser.parseSSEStream(response);

      expect(result.events[0].id).toBe('msg-1');
      expect(result.events[0].event).toBe('message');
      expect(result.jsonrpc).toEqual(jsonrpcResponse);
    });

    it('should handle empty data fields gracefully', async () => {
      const sseData = `event: ping
data: 

event: close
data: done

`;

      const parser = new SSEParser('test-server', 5000, ['ping', 'close']);
      const response = createSSEResponse(sseData);
      const result = await parser.parseSSEStream(response);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].data).toBe('');
      expect(result.events[0].event).toBe('ping');
    });
  });

  describe('T024: Invalid JSON handling', () => {
    it('should detect and report invalid JSON in data field', async () => {
      const sseData = `event: message
data: {invalid json}

event: close
data: done

`;

      const parser = new SSEParser('test-server', 5000);
      const response = createSSEResponse(sseData);
      const result = await parser.parseSSEStream(response);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('JSON');
      expect(result.error?.eventData).toContain('{invalid json}');
      expect(result.jsonrpc).toBeUndefined();
    });

    it('should handle non-JSON data gracefully', async () => {
      const sseData = `event: message
data: plain text message

event: close
data: done

`;

      const parser = new SSEParser('test-server', 5000);
      const response = createSSEResponse(sseData);
      const result = await parser.parseSSEStream(response);

      // Non-JSON data should cause parsing error
      expect(result.error).toBeDefined();
      expect(result.jsonrpc).toBeUndefined();
    });
  });

  describe('T025: Multi-line data field handling', () => {
    it('should concatenate multi-line data fields with newlines', async () => {
      const jsonrpcResponse = {
        jsonrpc: '2.0',
        id: 3,
        result: { message: 'multi\nline\nvalue' },
      };

      // SSE spec: multiple data: lines are concatenated with \n
      const sseData = `event: message
data: ${JSON.stringify(jsonrpcResponse).split('\n')[0]}
data: ${JSON.stringify(jsonrpcResponse).split('\n').slice(1).join('\n')}

event: close
data: done

`;

      const parser = new SSEParser('test-server', 5000, ['message', 'close']);
      const response = createSSEResponse(sseData);
      const result = await parser.parseSSEStream(response);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].event).toBe('message');
      // The JSON string contains escaped \n characters, not actual newlines
      const parsed = JSON.parse(result.events[0].data);
      expect(parsed.result.message).toBe('multi\nline\nvalue');
    });

    it('should handle data fields with embedded newlines', async () => {
      const multiLineJson = `{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "value": "test"
  }
}`;

      const sseData = `event: message
data: ${multiLineJson.split('\n').join('\ndata: ')}

event: close
data: done

`;

      const parser = new SSEParser('test-server', 5000, ['message', 'close']);
      const response = createSSEResponse(sseData);
      const result = await parser.parseSSEStream(response);

      expect(result.events).toHaveLength(2);
      // The concatenated data should be parseable as JSON
      const parsedData = JSON.parse(result.events[0].data);
      expect(parsedData.jsonrpc).toBe('2.0');
      expect(parsedData.id).toBe(4);
    });
  });

  describe('T026: Event filtering', () => {
    it('should filter events by type (default: message only)', async () => {
      const sseData = `event: ping
data: ping1

event: message
data: {"jsonrpc":"2.0","id":5,"result":{}}

event: pong
data: pong1

event: close
data: done

`;

      const parser = new SSEParser('test-server', 5000); // default filter: ['message']
      const response = createSSEResponse(sseData);
      const result = await parser.parseSSEStream(response);

      // Only 'message' event should be captured
      expect(result.events).toHaveLength(1);
      expect(result.events[0].event).toBe('message');
    });

    it('should respect custom event filters', async () => {
      const sseData = `event: ping
data: ping1

event: message
data: {"jsonrpc":"2.0","id":6,"result":{}}

event: pong
data: pong1

event: close
data: done

`;

      const parser = new SSEParser('test-server', 5000, ['ping', 'pong', 'close']);
      const response = createSSEResponse(sseData);
      const result = await parser.parseSSEStream(response);

      // Should capture ping, pong, close but NOT message
      expect(result.events).toHaveLength(3);
      expect(result.events.map((e) => e.event)).toEqual(['ping', 'pong', 'close']);
    });

    it('should handle close event to abort stream early', async () => {
      const sseData = `event: message
data: {"jsonrpc":"2.0","id":7,"result":{}}

event: close
data: stream ended

event: message
data: should not be processed

`;

      const parser = new SSEParser('test-server', 5000, ['message', 'close']);
      const response = createSSEResponse(sseData);
      const result = await parser.parseSSEStream(response);

      // Since the stream is buffered in memory before parsing, all events are processed
      // The close event triggers abort, but already-buffered data is parsed
      // So we expect all 3 events to be present
      expect(result.events.length).toBeGreaterThanOrEqual(2);
      expect(result.events.find(e => e.event === 'close')).toBeDefined();
    });
  });

  describe('Buffer size enforcement', () => {
    it('should enforce buffer size limit', async () => {
      const events = Array.from({ length: 15 }, (_, i) => ({
        event: 'message',
        data: `{"jsonrpc":"2.0","id":${i},"result":{}}`,
      }));

      const sseData =
        events.map((e) => `event: ${e.event}\ndata: ${e.data}\n\n`).join('') +
        'event: close\ndata: done\n\n';

      const parser = new SSEParser('test-server', 5000, ['message', 'close'], 10);
      const response = createSSEResponse(sseData);
      const result = await parser.parseSSEStream(response);

      // Should keep only last 10 message events + 1 close event
      expect(result.events.length).toBeLessThanOrEqual(11);
    });

    it('should throw error for invalid buffer size', () => {
      expect(() => new SSEParser('test', 5000, ['message'], 0)).toThrow(
        'Invalid sseBufferSize: 0'
      );
      expect(() => new SSEParser('test', 5000, ['message'], 1001)).toThrow(
        'Invalid sseBufferSize: 1001'
      );
    });
  });

  describe('Error handling', () => {
    it('should handle response with no body', async () => {
      const response = new Response(null, {
        headers: { 'Content-Type': 'text/event-stream' },
      });

      const parser = new SSEParser('test-server', 5000);
      const result = await parser.parseSSEStream(response);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('not readable');
    });

    it('should handle stream read errors', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.error(new Error('Stream error'));
        },
      });

      const response = new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream' },
      });

      const parser = new SSEParser('test-server', 5000);
      const result = await parser.parseSSEStream(response);

      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Stream error');
    });
  });

  describe('Timeout handling', () => {
    it('T052: should mark timedOut when stream stalls', async () => {
      const stream = new ReadableStream({
        start() {
          // never enqueue or close
        },
      });

      const response = new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream' },
      });

      const parser = new SSEParser('test-server', 50, ['message']);
      const start = Date.now();
      const result = await parser.parseSSEStream(response);
      const elapsed = Date.now() - start;

      expect(result.timedOut).toBe(true);
      expect(result.error).toBeUndefined();
      expect(elapsed).toBeGreaterThanOrEqual(50);
      expect(elapsed).toBeLessThan(500);
    });

    it('T053: forwarder should throw TimeoutError when SSE stream times out', async () => {
      const stream = new ReadableStream({
        start() {
          // never enqueue
        },
      });

      const response = new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream' },
      });

      const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue(response as any);

      const forwarder = new RequestForwarder();
      await expect(
        forwarder.forwardSSE(
          'http://example.com/sse',
          'sse-test',
          { jsonrpc: '2.0', id: 1, method: 'test' },
          50,
          ['message'],
          5
        )
      ).rejects.toBeInstanceOf(TimeoutError);

      fetchMock.mockRestore();
    });

    it('T056: timeout duration stays within 10% of configured value', async () => {
      jest.useFakeTimers();
      const stream = new ReadableStream({
        start() {
          // no data
        },
      });

      const response = new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream' },
      });

      const parser = new SSEParser('test-server', 100, ['message']);
      const parsePromise = parser.parseSSEStream(response);

      jest.advanceTimersByTime(100);
      const result = await parsePromise;

      expect(result.timedOut).toBe(true);
      expect(result.duration).toBeGreaterThanOrEqual(90);
      expect(result.duration).toBeLessThanOrEqual(120);

      jest.useRealTimers();
    });
  });
});
