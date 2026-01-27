/**
 * T028: Integration test proxy with Azure APIM-like SSE endpoint
 */

import Fastify from 'fastify';
import http from 'http';
import { ConfigHotReloadManager } from '../../src/config/hot-reload';
import { registerProxyRoutes } from '../../src/proxy/routes/proxy';
import { MCPServer } from '../../src/config/loader';

describe('Azure APIM SSE Integration', () => {
  let apimServer: http.Server;
  let apimPort: number;

  beforeAll(async () => {
    apimPort = 9100;
    apimServer = http.createServer((req, res) => {
      if (req.url === '/apim/sse') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        const payload = {
          jsonrpc: '2.0',
          id: 1,
          result: { status: 'ok', source: 'apim' },
        };

        res.write(`event: message\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        res.write(`event: close\n`);
        res.write(`data: done\n\n`);
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      apimServer.listen(apimPort, () => resolve());
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      apimServer.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('should proxy SSE responses from APIM endpoint', async () => {
    const app = Fastify({ logger: false });

    const mockConfig: MCPServer[] = [
      {
        id: 'azure-apim',
        url: `http://localhost:${apimPort}/apim/sse`,
        transport: 'sse',
        sseOptions: { sseEventFilter: ['message', 'close'] },
      },
    ];

    const mockManager = {
      getConfig: () => ({ mcpServers: mockConfig }),
      on: jest.fn(),
    } as unknown as ConfigHotReloadManager;

    await registerProxyRoutes(app, mockManager);

    const response = await app.inject({
      method: 'POST',
      url: '/proxy/azure-apim',
      payload: { jsonrpc: '2.0', method: 'initialize', id: 1 },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-proxy-transport']).toBe('sse');
    const body = JSON.parse(response.body);
    expect(body.result.status).toBe('ok');
    expect(body.result.source).toBe('apim');

    await app.close();
  });
});
