import { FilterRuleMatcher, type FilterRuleConfig } from './types';

export class FilterCompositionEngine {
  private rules: FilterRuleMatcher[] = [];

  constructor(ruleConfigs: FilterRuleConfig[]) {
    this.rules = ruleConfigs
      .filter((r) => r.enabled !== false)
      .sort((a, b) => (a.priority || 0) - (b.priority || 0))
      .map((r) => new FilterRuleMatcher(r));
  }

  evaluate(data: unknown): { allow: boolean; reasons: string[] } {
    if (this.rules.length === 0) {
      return { allow: true, reasons: ['No filters configured'] };
    }

    const reasons: string[] = [];
    let shouldDrop = false;

    for (const matcher of this.rules) {
      const result = matcher.evaluate(data);
      if (result.matched) {
        reasons.push(result.reason);
        shouldDrop = true;
        break; // First match wins
      }
    }

    return {
      allow: !shouldDrop,
      reasons,
    };
  }
}
