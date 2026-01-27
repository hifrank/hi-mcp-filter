import { getLogger } from '../common/logger';
import { ConfigWatcher } from './watcher';
import { AtomicConfigSwap } from './swap';
import { loadConfig, type ProxyConfig } from './loader';

export class ConfigHotReloadManager {
  private logger = getLogger();
  private watcher: ConfigWatcher | null = null;
  private swap: AtomicConfigSwap;
  private configFilePath: string;
  private isReloading = false;

  constructor(configFilePath: string) {
    this.configFilePath = configFilePath;
    this.swap = new AtomicConfigSwap();
  }

  async initialize(): Promise<void> {
    try {
      // Load initial config
      const initialConfig = await loadConfig(this.configFilePath);
      await this.swap.swap(initialConfig);

      // Setup file watcher
      this.watcher = new ConfigWatcher(1000, async (filePath) => {
        await this.handleConfigChange(filePath);
      });

      this.watcher.watch(this.configFilePath);
      this.logger.info('Config hot-reload manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize config hot-reload manager', error as Error);
      throw error;
    }
  }

  private async handleConfigChange(filePath: string): Promise<void> {
    if (this.isReloading) {
      this.logger.debug('Config reload already in progress, skipping');
      return;
    }

    this.isReloading = true;

    try {
      this.logger.info('Reloading config from file', { filePath });
      const newConfig = await loadConfig(filePath);
      const success = await this.swap.swap(newConfig);

      if (success) {
        this.logger.info('Config reloaded successfully');
      } else {
        this.logger.warn('Config reload failed validation');
      }
    } catch (error) {
      this.logger.error('Config reload failed', error as Error);
    } finally {
      this.isReloading = false;
    }
  }

  getConfig(): ProxyConfig | null {
    return this.swap.getCurrent();
  }

  async updateConfig(newConfig: ProxyConfig): Promise<boolean> {
    return this.swap.swap(newConfig);
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.stop();
    }
    this.logger.info('Config hot-reload manager stopped');
  }
}
