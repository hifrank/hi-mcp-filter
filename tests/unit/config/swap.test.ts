import { AtomicConfigSwap } from '../../../src/config/swap';
import type { ProxyConfig } from '../../../src/config/loader';

describe('Atomic Config Swap', () => {
  it('should swap valid config', async () => {
    const swap = new AtomicConfigSwap();

    const config: ProxyConfig = {
      server: { port: 8080 },
      mcpServers: [{ id: 'server-1', url: 'http://localhost:5000' }],
      filters: [],
      transformations: [],
      plugins: [],
    };

    const result = await swap.swap(config);
    expect(result).toBe(true);
    expect(swap.getCurrent()).toBeDefined();
  });

  it('should reject invalid config', async () => {
    const swap = new AtomicConfigSwap();

    const invalidConfig = {
      // missing required 'server' field
      filters: [],
    } as any;

    const result = await swap.swap(invalidConfig);
    expect(result).toBe(false);
  });

  it('should keep old config on validation error', async () => {
    const swap = new AtomicConfigSwap();

    const validConfig: ProxyConfig = {
      server: { port: 8080 },
      filters: [],
    };

    await swap.swap(validConfig);
    const oldConfig = swap.getCurrent();

    const invalidConfig = {
      server: 'invalid',
    } as any;

    await swap.swap(invalidConfig);
    expect(swap.getCurrent()).toEqual(oldConfig);
  });
});
