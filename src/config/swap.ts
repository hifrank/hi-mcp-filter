import ajvFactory from 'ajv';
import addFormats from 'ajv-formats';
import configSchema from './schema.json';
import type { ProxyConfig } from './loader';

const ajv = new ajvFactory({ strict: false });
addFormats(ajv);
const validateConfig = ajv.compile(configSchema);

export class ConfigValidator {
  validate(config: unknown): { valid: boolean; errors: string[] } {
    const isValid = validateConfig(config);

    if (!isValid) {
      const errors = (validateConfig.errors || []).map((e) => e.message || 'Unknown error');
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  validatePartial(
    config: Partial<ProxyConfig>
  ): { valid: boolean; errors: string[] } {
    // Validate individual parts without requiring all fields
    return this.validate(config);
  }
}

export class AtomicConfigSwap {
  private currentConfig: ProxyConfig | null = null;
  private pendingConfig: ProxyConfig | null = null;

  swap(newConfig: unknown): boolean {
    const validator = new ConfigValidator();
    const validation = validator.validate(newConfig);

    if (!validation.valid) {
      return false;
    }

    const typedConfig = newConfig as ProxyConfig;
    this.pendingConfig = typedConfig;
    this.currentConfig = typedConfig;

    return true;
  }

  getCurrent(): ProxyConfig | null {
    return this.currentConfig;
  }

  getPending(): ProxyConfig | null {
    return this.pendingConfig;
  }
}
