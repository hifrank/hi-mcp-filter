import Ajv from 'ajv';
import schema from './schema.json';

const ajv = new Ajv({
  strict: false,
  useDefaults: false,
  coerceTypes: false,
});

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: Record<string, unknown>;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ message: string; path: string }>;
}

const validator = ajv.compile(schema);

export function validateMCPResponse(data: unknown): ValidationResult {
  const valid = validator(data) as boolean;

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = (validator.errors || []).map((error) => ({
    message: error.message || 'Unknown validation error',
    path: error.schemaPath || '',
  }));

  return { valid: false, errors };
}

export function isMCPResponse(data: unknown): data is MCPResponse {
  return validator(data) as boolean;
}
