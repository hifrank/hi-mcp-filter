import { PluginLoader } from '../../../src/plugin/types';
import type { PluginInterface } from '../../../src/plugin/types';

describe('Plugin Loader', () => {
  it('should load valid plugin', async () => {
    const loader = new PluginLoader();

    // Create a mock plugin
    const mockPlugin: PluginInterface = {
      name: 'test-plugin',
      version: '1.0.0',
      async filter() {
        return { action: 'allow', reason: 'Test' };
      },
    };

    const isValid = await loader.validatePlugin(mockPlugin);
    expect(isValid).toBe(true);
  });

  it('should reject plugin without name', async () => {
    const loader = new PluginLoader();

    const invalidPlugin = {
      version: '1.0.0',
      async filter() {
        return { action: 'allow', reason: 'Test' };
      },
    } as any;

    const isValid = await loader.validatePlugin(invalidPlugin);
    expect(isValid).toBe(false);
  });

  it('should reject plugin without filter or transform', async () => {
    const loader = new PluginLoader();

    const invalidPlugin = {
      name: 'test',
      version: '1.0.0',
    } as any;

    const isValid = await loader.validatePlugin(invalidPlugin);
    expect(isValid).toBe(false);
  });
});
