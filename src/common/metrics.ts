export interface Histogram {
  observe(value: number, labels?: Record<string, string>): void;
  getCount(labels?: Record<string, string>): number;
}

export interface Counter {
  inc(labels?: Record<string, string>, value?: number): void;
  getValue(labels?: Record<string, string>): number;
}

export interface MetricsCollector {
  requestLatency: Histogram;
  requestCount: Counter;
  filterCount: Counter;
  transformCount: Counter;
  pluginCount: Counter;
  errorCount: Counter;
}

export function createMetricsCollector(): MetricsCollector {
  const histograms = new Map<string, { values: number[] }>();
  const counters = new Map<string, number>();

  const formatKey = (name: string, labels?: Record<string, string>): string =>
    labels ? `${name}:${JSON.stringify(labels)}` : name;

  const createHistogram = (name: string): Histogram => {
    if (!histograms.has(name)) {
      histograms.set(name, { values: [] });
    }

    return {
      observe: (value: number, labels?: Record<string, string>) => {
        const key = formatKey(name, labels);
        if (!histograms.has(key)) {
          histograms.set(key, { values: [] });
        }
        histograms.get(key)?.values.push(value);
      },
      getCount: (labels?: Record<string, string>) => {
        const key = formatKey(name, labels);
        const record = histograms.get(key);
        return record?.values.length ?? 0;
      },
    };
  };

  const createCounter = (name: string): Counter => {
    if (!counters.has(name)) {
      counters.set(name, 0);
    }

    return {
      inc: (labels?: Record<string, string>, value?: number) => {
        const key = formatKey(name, labels);
        const current = counters.get(key) || 0;
        counters.set(key, current + (value || 1));
      },
      getValue: (labels?: Record<string, string>) => {
        const key = formatKey(name, labels);
        return counters.get(key) ?? 0;
      },
    };
  };

  return {
    requestLatency: createHistogram('request_latency_ms'),
    requestCount: createCounter('request_count'),
    filterCount: createCounter('filter_count'),
    transformCount: createCounter('transform_count'),
    pluginCount: createCounter('plugin_count'),
    errorCount: createCounter('error_count'),
  };
}

// Global instance
let globalMetrics: MetricsCollector | undefined;

export function getMetrics(): MetricsCollector {
  if (!globalMetrics) {
    globalMetrics = createMetricsCollector();
  }
  return globalMetrics;
}
