import { FastifyInstance } from 'fastify';
import { getLogger } from '../common/logger';

export class GracefulShutdown {
  private logger = getLogger();
  private isShuttingDown = false;
  private shutdownTimeout: NodeJS.Timeout | null = null;

  async shutdown(app: FastifyInstance, timeoutMs: number = 30000): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.info('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;

    this.logger.info('Starting graceful shutdown', { timeoutMs });

    // Start timeout
    this.shutdownTimeout = setTimeout(() => {
      this.logger.warn('Graceful shutdown timeout exceeded, forcing exit');
      process.exit(1);
    }, timeoutMs);

    try {
      // Close server
      await app.close();
      this.logger.info('Server closed successfully');

      // Clear timeout
      if (this.shutdownTimeout) {
        clearTimeout(this.shutdownTimeout);
      }

      // Allow graceful process exit
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during graceful shutdown', error as Error);
      process.exit(1);
    }
  }

  registerSignalHandlers(app: FastifyInstance, timeoutMs: number = 30000): void {
    const signals = ['SIGTERM', 'SIGINT'];

    signals.forEach((signal) => {
      process.on(signal, () => {
        this.logger.info(`Received ${signal}, initiating graceful shutdown`);
        this.shutdown(app, timeoutMs).catch((error) => {
          this.logger.error('Shutdown error', error);
        });
      });
    });

    this.logger.info('Signal handlers registered');
  }
}
