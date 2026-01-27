import { TransformationExecutor } from './types';
import type { TransformationRuleConfig } from './types';

export class TransformationPipeline {
  private rules: TransformationRuleConfig[];

  constructor(ruleConfigs: TransformationRuleConfig[]) {
    this.rules = ruleConfigs
      .filter((r) => r.enabled !== false)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  async execute(data: unknown): Promise<unknown> {
    let result = data;
    const executor = new TransformationExecutor();

    for (const rule of this.rules) {
      const transformResult = await executor.execute(result, rule.expression, rule.onError);

      if (transformResult.success) {
        result = transformResult.data;
      } else if (rule.onError === 'fail') {
        throw new Error(`Transformation failed: ${transformResult.error}`);
      }
      // skip and passthrough: continue with result
    }

    return result;
  }
}

export class TransformationEngine {
  private pipeline: TransformationPipeline;

  constructor(ruleConfigs: TransformationRuleConfig[]) {
    this.pipeline = new TransformationPipeline(ruleConfigs);
  }

  async transformResponse(data: unknown): Promise<unknown> {
    return this.pipeline.execute(data);
  }

  static create(ruleConfigs: TransformationRuleConfig[]): TransformationEngine {
    return new TransformationEngine(ruleConfigs);
  }
}
