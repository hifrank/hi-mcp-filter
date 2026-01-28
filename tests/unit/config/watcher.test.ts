import { ConfigWatcher } from '../../../src/config/watcher';

describe('Config Watcher', () => {
  it('should debounce file changes', async () => {
    const changes: string[] = [];
    const callback = async (filePath: string) => {
      changes.push(filePath);
    };

    const watcher = new ConfigWatcher(100, callback);

    // Simulate rapid changes
    watcher['handleChange']('/path/to/config.json');
    watcher['handleChange']('/path/to/config.json');
    watcher['handleChange']('/path/to/config.json');

    // Wait for debounce
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 200);
      timer.unref();
    });

    // Should only call callback once due to debouncing
    expect(changes.length).toBe(1);

    await watcher.stop();
  });

  it('should call callback after debounce timeout', async () => {
    const callback = jest.fn();
    const watcher = new ConfigWatcher(50, callback);

    watcher['handleChange']('/path/to/config.json');

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 100);
      timer.unref();
    });

    expect(callback).toHaveBeenCalled();

    await watcher.stop();
  });
});
