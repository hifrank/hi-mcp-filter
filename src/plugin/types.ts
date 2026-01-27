import type { ILogger } from '../common/logger';

export interface PluginContext {
  request: unknown;
  response: unknown;
  logger: ILogger;
  config: Record<string, unknown>;
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

export type PluginFunction<T = unknown> = (context: PluginContext) => Promise<T>;

export class PluginLoader {
  async loadPlugin(filePath: string): Promise<PluginInterface> {
    try {
      const importedModule: unknown = await import(filePath);
      const pluginCandidate = (importedModule as { default?: unknown }).default ?? importedModule;

      if (!this.isPlugin(pluginCandidate)) {
        throw new Error('Plugin must export name and version');
      }

      return pluginCandidate;
    } catch (error) {
      throw new Error(`Failed to load plugin from ${filePath}: ${String(error)}`);
    }
  }

  validatePlugin(plugin: PluginInterface): boolean {
    return this.isPlugin(plugin);
  }

  private isPlugin(candidate: unknown): candidate is PluginInterface {
    if (!candidate || typeof candidate !== 'object') {
      return false;
    }

    const plugin = candidate as Partial<PluginInterface>;

    if (!plugin.name || !plugin.version) {
      return false;
    }

    if (typeof plugin.filter !== 'function' && typeof plugin.transform !== 'function') {
      return false;
    }

    return true;
  }
}
