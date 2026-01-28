import fs from 'fs';
import ajvFactory from 'ajv';
import addFormats from 'ajv-formats';
import { getLogger } from '../common/logger';
import { ConfigError } from '../common/errors';
import configSchema from './schema.json';

const ajv = new ajvFactory({ strict: true });
addFormats(ajv);
const validateConfig = ajv.compile(configSchema);

function isProxyConfig(config: unknown): config is ProxyConfig {
  return validateConfig(config) as boolean;
}

export interface MCPServer {
  id: string;
  url: string;
  timeout?: number;
  // SSE Transport Support (Feature 002)
  transport?: 'http' | 'sse' | 'auto';
  sseOptions?: {
    sseEventFilter?: string[];
    sseBufferSize?: number;
    sseStreamingMode?: boolean;
  };
}

export interface FilterRule {
  id: string;
  name?: string;
  enabled?: boolean;
  condition: {
    field: string;
    operator: 'equals' | 'contains' | 'matches' | 'exists' | 'not';
    value?: unknown;
  };
  action: 'allow' | 'drop';
  composition?: 'AND' | 'OR' | 'NONE';
  priority?: number;
}

export interface TransformationRule {
  id: string;
  name?: string;
  enabled?: boolean;
  expression: string;
  order?: number;
  onError?: 'skip' | 'passthrough' | 'fail';
}

export interface Plugin {
  name: string;
  version?: string;
  filePath: string;
  enabled?: boolean;
  errorBehavior?: 'fail-open' | 'fail-secure' | 'retry';
  retryAttempts?: number;
  timeout?: number;
}

export interface ProxyConfig {
  server: {
    port: number;
    host?: string;
    requestTimeout?: number;
  };
  mcpServers?: MCPServer[];
  filters?: FilterRule[];
  transformations?: TransformationRule[];
  plugins?: Plugin[];
  logging?: {
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
    format?: 'json' | 'pretty';
  };
  hotReload?: {
    enabled?: boolean;
    debounceMs?: number;
  };
}

export function loadConfig(filePath: string): ProxyConfig {
  const logger = getLogger();

  try {
    if (!fs.existsSync(filePath)) {
      throw new ConfigError(`Configuration file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsedConfig = JSON.parse(content) as unknown;

    if (!isProxyConfig(parsedConfig)) {
      const errors = validateConfig.errors || [];
      const errorMessages = errors.map((e) => `${e.schemaPath}: ${e.message}`).join('; ');
      throw new ConfigError(`Configuration validation failed: ${errorMessages}`);
    }

    logger.info('Configuration loaded successfully', {
      filePath,
      servers: parsedConfig.mcpServers?.length || 0,
      filters: parsedConfig.filters?.length || 0,
      transformations: parsedConfig.transformations?.length || 0,
      plugins: parsedConfig.plugins?.length || 0,
    });

    return parsedConfig;
  } catch (error) {
    if (error instanceof ConfigError) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new ConfigError(`Invalid JSON in configuration file: ${error.message}`);
    }

    throw new ConfigError(`Failed to load configuration: ${String(error)}`);
  }
}

export function loadConfigFromEnv(): ProxyConfig {
  const configPath = process.env.CONFIG_PATH || './config/proxy.json';
  return loadConfig(configPath);
}

export function validateConfigFile(filePath: string): {
  valid: boolean;
  errors: string[];
} {
  try {
    if (!fs.existsSync(filePath)) {
      return { valid: false, errors: [`File not found: ${filePath}`] };
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content) as unknown;

    const valid = validateConfig(config);
    if (!valid) {
      const errors = (validateConfig.errors || []).map((e) => e.message || 'Unknown error');
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}
