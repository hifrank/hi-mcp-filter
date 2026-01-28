import { GracefulShutdown } from '../../../src/proxy/shutdown';

describe('Graceful Shutdown', () => {
  let shutdown: GracefulShutdown;

  beforeEach(() => {
    shutdown = new GracefulShutdown();
  });

  it('should prevent multiple shutdowns', async () => {
    const mockApp = { close: jest.fn().mockResolvedValue(undefined) };

    // Mock process.exit to prevent actual exit
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // First shutdown
    shutdown.shutdown(mockApp as any, 1000).catch(() => {});

    // Second shutdown should return early
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 100);
      timer.unref();
    });
    expect(shutdown['isShuttingDown']).toBe(true);

    exitSpy.mockRestore();
  });

  it('should timeout if shutdown takes too long', async () => {
    const mockApp = {
      close: jest.fn(
        () =>
          new Promise((resolve) => {
            const timer = setTimeout(resolve, 5000);
            timer.unref();
          })
      ),
    };

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    shutdown.shutdown(mockApp as any, 100).catch(() => {});

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 150);
      timer.unref();
    });
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});
