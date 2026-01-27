import pino from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'pretty';
  name: string;
}

export interface ILogger {
  trace(msg: string, data?: Record<string, unknown>): void;
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string, data?: Record<string, unknown> | Error): void;
  fatal(msg: string, data?: Record<string, unknown> | Error): void;
}

let pinoInstance: pino.Logger;

export function createLogger(config: LoggerConfig): ILogger {
  const transport: pino.TransportSingleOptions | undefined =
    config.format === 'pretty'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false,
          },
        }
      : undefined;

  const destination: pino.DestinationStream | undefined = transport
    ? (pino.transport(transport) as pino.DestinationStream)
    : undefined;

  pinoInstance = pino(
    {
      level: config.level,
      name: config.name,
    },
    destination
  );

  return {
    trace: (msg, data) => pinoInstance.trace(data, msg),
    debug: (msg, data) => pinoInstance.debug(data, msg),
    info: (msg, data) => pinoInstance.info(data, msg),
    warn: (msg, data) => pinoInstance.warn(data, msg),
    error: (msg, data) => pinoInstance.error(data, msg),
    fatal: (msg, data) => pinoInstance.fatal(data, msg),
  };
}

export function getLogger(): ILogger {
  if (!pinoInstance) {
    pinoInstance = pino({ level: 'info', name: 'mcp-filter' });
  }

  return {
    trace: (msg, data) => pinoInstance.trace(data, msg),
    debug: (msg, data) => pinoInstance.debug(data, msg),
    info: (msg, data) => pinoInstance.info(data, msg),
    warn: (msg, data) => pinoInstance.warn(data, msg),
    error: (msg, data) => pinoInstance.error(data, msg),
    fatal: (msg, data) => pinoInstance.fatal(data, msg),
  };
}
