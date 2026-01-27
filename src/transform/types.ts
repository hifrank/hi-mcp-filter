export interface TransformationRuleConfig {
  id: string;
  name?: string;
  enabled?: boolean;
  expression: string;
  order?: number;
  onError?: 'skip' | 'passthrough' | 'fail';
}

export interface TransformationResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export class TransformationExecutor {
  async execute(
    data: unknown,
    _expression: string,
    onError: 'skip' | 'passthrough' | 'fail' = 'passthrough'
  ): Promise<TransformationResult> {
    try {
      // Placeholder: In real implementation, use JSONata
      // For now, just return the data unchanged
      return {
        success: true,
        data,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      switch (onError) {
        case 'skip':
          return { success: false, error: errorMessage };
        case 'fail':
          return { success: false, error: errorMessage };
        case 'passthrough':
        default:
          return { success: true, data };
      }
    }
  }
}
