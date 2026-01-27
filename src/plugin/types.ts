export interface PluginContext {
  request: unknown;
  response: unknown;
  logger: any;
  config: any;
}

export interface FilterResult {
  action: 'allow' | 'drop';
  reason: string;
}

export interface PluginInterface {
  name: string;
  version: string;
  filter?(context: PluginContext): Promise<FilterResult>;
  transform?(context: PluginContext): Promise<unknown>;
}

export interface PluginConfig {
  name: string;
  version?: string;
  filePath: string;
  enabled?: boolean;
  errorBehavior?: 'fail-open' | 'fail-secure' | 'retry';
  retryAttempts?: number;
  timeout?: number;
}

export type PluginFunction = (context: PluginContext) => Promise<any>;

export class PluginLoader {
  async loadPlugin(filePath: string): Promise<PluginInterface> {
    try {
      const module = await import(filePath);
      const plugin = module.default || module;

      if (!plugin.name || !plugin.version) {
        throw new Error('Plugin must export name and version');
      }

      return plugin as PluginInterface;
    } catch (error) {
      throw new Error(`Failed to load plugin from ${filePath}: ${error}`);
    }
  }

  async validatePlugin(plugin: PluginInterface): Promise<boolean> {
    if (!plugin.name || !plugin.version) {
      return false;
    }

    if (typeof plugin.filter !== 'function' && typeof plugin.transform !== 'function') {
      return false;
    }

    return true;
  }
}
