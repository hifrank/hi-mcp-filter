import fs from 'fs';
import chokidar from 'chokidar';
import { getLogger } from '../common/logger';

export interface HotReloadConfig {
  enabled: boolean;
  debounceMs: number;
}

export class ConfigWatcher {
  private logger = getLogger();
  private watcher: chokidar.FSWatcher | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceMs: number;
  private callback: (filePath: string) => Promise<void> | void;

  constructor(
    debounceMs: number = 1000,
    callback: (filePath: string) => Promise<void> | void = async () => {}
  ) {
    this.debounceMs = debounceMs;
    this.callback = callback;
  }

  watch(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      this.logger.warn(`File not found for watching: ${filePath}`);
      return;
    }

    this.watcher = chokidar.watch(filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100,
      },
    });

    this.watcher.on('change', (path) => {
      this.logger.debug(`File changed: ${path}`);
      void this.handleChange(path);
    });

    this.logger.info(`Watching file for changes: ${filePath}`);
  }

  private handleChange(filePath: string): void {
    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Set new debounce timer
    this.debounceTimer = setTimeout(() => {
      void (async () => {
        try {
          const result = this.callback(filePath);
          await Promise.resolve(result);
        } catch (error) {
          this.logger.error('Config reload callback failed', error as Error);
        }
      })();
    }, this.debounceMs);
    this.debounceTimer.unref();
  }

  stop(): void {
    if (this.watcher) {
      void this.watcher.close();
      this.logger.info('File watcher stopped');
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}
