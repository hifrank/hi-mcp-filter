import { FilterCompositionEngine } from './composition';
import type { FilterRuleConfig } from './types';

export class FilterEngine {
  private compositionEngine: FilterCompositionEngine;

  constructor(ruleConfigs: FilterRuleConfig[]) {
    this.compositionEngine = new FilterCompositionEngine(ruleConfigs);
  }

  async evaluateResponse(data: unknown): Promise<{
    allow: boolean;
    reasons: string[];
  }> {
    return this.compositionEngine.evaluate(data);
  }

  static create(ruleConfigs: FilterRuleConfig[]): FilterEngine {
    return new FilterEngine(ruleConfigs);
  }
}
