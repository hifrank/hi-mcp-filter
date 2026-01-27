/**
 * T027: Contract test for SSE format compliance
 * 
 * Ensures SSE parser adheres to W3C Server-Sent Events specification:
 * https://html.spec.whatwg.org/multipage/server-sent-events.html
 */

import { SSEParser } from '../../src/proxy/sse-parser';

describe('SSE Format Compliance (W3C Spec)', () => {
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

  describe('SSE Field Parsing', () => {
    it('should parse event field correctly', async () => {
      const sseData = `event: custom-event
data: test data

`;
      const parser = new SSEParser('test', 5000, ['custom-event']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      expect(result.events[0].event).toBe('custom-event');
    });

    it('should default to "message" event type when event field is missing', async () => {
      const sseData = `data: test data

`;
      const parser = new SSEParser('test', 5000, ['message']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      expect(result.events[0].event).toBe('message');
    });

    it('should parse id field correctly', async () => {
      const sseData = `id: event-123
data: test

`;
      const parser = new SSEParser('test', 5000, ['message']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      expect(result.events[0].id).toBe('event-123');
    });

    it('should handle missing id field', async () => {
      const sseData = `data: test

`;
      const parser = new SSEParser('test', 5000, ['message']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      expect(result.events[0].id).toBeUndefined();
    });
  });

  describe('Data Field Concatenation', () => {
    it('should concatenate multiple data fields with newlines', async () => {
      const sseData = `data: line 1
data: line 2
data: line 3

`;
      const parser = new SSEParser('test', 5000, ['message']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      // eventsource-parser concatenates with \n
      expect(result.events[0].data).toContain('line 1');
      expect(result.events[0].data).toContain('line 2');
      expect(result.events[0].data).toContain('line 3');
    });

    it('should handle empty data field', async () => {
      const sseData = `data:

`;
      const parser = new SSEParser('test', 5000, ['message']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      expect(result.events[0].data).toBe('');
    });

    it('should preserve whitespace in data field', async () => {
      const sseData = `data:   spaces   

`;
      const parser = new SSEParser('test', 5000, ['message']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      expect(result.events[0].data).toBe('  spaces   ');
    });
  });

  describe('Event Dispatch', () => {
    it('should dispatch event only after blank line', async () => {
      const sseData = `event: test
data: first

event: test
data: second

`;
      const parser = new SSEParser('test', 5000, ['test']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      expect(result.events).toHaveLength(2);
      expect(result.events[0].data).toBe('first');
      expect(result.events[1].data).toBe('second');
    });

    it('should handle multiple blank lines between events', async () => {
      const sseData = `data: event1


data: event2

`;
      const parser = new SSEParser('test', 5000, ['message']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      expect(result.events).toHaveLength(2);
    });
  });

  describe('Comment Lines', () => {
    it('should ignore comment lines starting with colon', async () => {
      const sseData = `:this is a comment
data: actual data
:another comment

`;
      const parser = new SSEParser('test', 5000, ['message']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      expect(result.events).toHaveLength(1);
      expect(result.events[0].data).toBe('actual data');
    });

    it('should use comments as keep-alive heartbeat', async () => {
      const sseData = `:keep-alive
:heartbeat
data: payload

`;
      const parser = new SSEParser('test', 5000, ['message']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      // Comments don't create events
      expect(result.events).toHaveLength(1);
      expect(result.events[0].data).toBe('payload');
    });
  });

  describe('Character Encoding', () => {
    it('should handle UTF-8 encoded data', async () => {
      const sseData = `data: Hello 世界 🌍

`;
      const parser = new SSEParser('test', 5000, ['message']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      expect(result.events[0].data).toBe('Hello 世界 🌍');
    });

    it('should handle special characters in event names', async () => {
      const sseData = `event: user-action:click
data: clicked

`;
      const parser = new SSEParser('test', 5000, ['user-action:click']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      expect(result.events[0].event).toBe('user-action:click');
    });
  });

  describe('Retry Field (Ignored)', () => {
    it('should parse events even when retry field is present', async () => {
      const sseData = `retry: 10000
data: test data

`;
      const parser = new SSEParser('test', 5000, ['message']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      // Parser doesn't need to handle retry (client-side concern)
      expect(result.events).toHaveLength(1);
      expect(result.events[0].data).toBe('test data');
    });
  });

  describe('Edge Cases', () => {
    it('should handle events with only event field', async () => {
      const sseData = `event: ping
data:

`;
      const parser = new SSEParser('test', 5000, ['ping']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      expect(result.events).toHaveLength(1);
      expect(result.events[0].event).toBe('ping');
      expect(result.events[0].data).toBe('');
    });

    it('should handle rapid-fire events', async () => {
      const events = Array.from({ length: 100 }, (_, i) => 
        `data: event-${i}\n\n`
      ).join('');

      const parser = new SSEParser('test', 5000, ['message'], 100);
      const result = await parser.parseSSEStream(createSSEResponse(events));

      expect(result.events.length).toBeLessThanOrEqual(100);
    });

    it('should handle very long data fields', async () => {
      const longData = 'x'.repeat(10000);
      const sseData = `data: ${longData}

`;
      const parser = new SSEParser('test', 5000, ['message']);
      const result = await parser.parseSSEStream(createSSEResponse(sseData));

      expect(result.events[0].data).toBe(longData);
      expect(result.events[0].data.length).toBe(10000);
    });
  });
});
