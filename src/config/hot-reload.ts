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

  initialize(): void {
    try {
      // Load initial config
      const initialConfig = loadConfig(this.configFilePath);
      this.swap.swap(initialConfig);

      // Setup file watcher
      this.watcher = new ConfigWatcher(1000, (filePath) => {
        this.handleConfigChange(filePath);
      });

      this.watcher.watch(this.configFilePath);
      this.logger.info('Config hot-reload manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize config hot-reload manager', error as Error);
      throw error;
    }
  }

  private handleConfigChange(filePath: string): void {
    if (this.isReloading) {
      this.logger.debug('Config reload already in progress, skipping');
      return;
    }

    this.isReloading = true;

    try {
      this.logger.info('Reloading config from file', { filePath });
      const newConfig = loadConfig(filePath);
      const success = this.swap.swap(newConfig);

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

  updateConfig(newConfig: unknown): boolean {
    return this.swap.swap(newConfig);
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.stop();
    }
    this.logger.info('Config hot-reload manager stopped');
  }
}
