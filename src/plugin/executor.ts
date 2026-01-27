import { getLogger } from '../common/logger';
import { getMetrics } from '../common/metrics';
import type { PluginConfig, PluginInterface, PluginContext } from './types';

export class PluginExecutor {
  private logger = getLogger();
  private metrics = getMetrics();

  async executeFilter(
    plugin: PluginInterface,
    context: PluginContext,
    config: PluginConfig
  ): Promise<{ action: 'allow' | 'drop'; reason: string }> {
    if (!plugin.filter) {
      return { action: 'allow', reason: 'Plugin has no filter function' };
    }

    const timeout = config.timeout || 5000;
    const maxRetries = config.errorBehavior === 'retry' ? config.retryAttempts || 3 : 1;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          plugin.filter(context),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Plugin timeout')), timeout)
          ),
        ]);

        this.metrics.pluginCount.inc();
        return result as { action: 'allow' | 'drop'; reason: string };
      } catch (error) {
        this.logger.warn(`Plugin filter failed (attempt ${attempt + 1}/${maxRetries})`, {
          plugin: config.name,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempt === maxRetries - 1) {
          if (config.errorBehavior === 'fail-secure') {
            return { action: 'drop', reason: 'Plugin error - fail-secure' };
          }
          // fail-open
          return { action: 'allow', reason: 'Plugin error - fail-open' };
        }
      }
    }

    return { action: 'allow', reason: 'Plugin execution complete' };
  }

  async executeTransform(
    plugin: PluginInterface,
    context: PluginContext,
    config: PluginConfig
  ): Promise<unknown> {
    if (!plugin.transform) {
      return context.response;
    }

    const timeout = config.timeout || 5000;

    try {
      return await Promise.race([
        plugin.transform(context),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Plugin timeout')), timeout)
        ),
      ]);
    } catch (error) {
      this.logger.error('Plugin transform failed', {
        plugin: config.name,
        error: error instanceof Error ? error.message : String(error),
      });

      if (config.errorBehavior === 'fail-secure') {
        throw error;
      }
      // fail-open
      return context.response;
    }
  }
}
