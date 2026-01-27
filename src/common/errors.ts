export class ProxyError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ProxyError';
    Object.setPrototypeOf(this, ProxyError.prototype);
  }
}

export class ValidationError extends ProxyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ConfigError extends ProxyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('CONFIG_ERROR', message, 500, details);
    this.name = 'ConfigError';
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}

export class BackendError extends ProxyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('BACKEND_ERROR', message, 502, details);
    this.name = 'BackendError';
    Object.setPrototypeOf(this, BackendError.prototype);
  }
}

export class PluginError extends ProxyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('PLUGIN_ERROR', message, 500, details);
    this.name = 'PluginError';
    Object.setPrototypeOf(this, PluginError.prototype);
  }
}

export class TimeoutError extends ProxyError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('TIMEOUT_ERROR', message, 504, details);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

export function isProxyError(error: unknown): error is ProxyError {
  return error instanceof ProxyError;
}
