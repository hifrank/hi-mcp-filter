import { JSONPath } from 'jsonpath-plus';

export interface FilterCondition {
  field: string;
  operator: 'equals' | 'contains' | 'matches' | 'exists' | 'not';
  value?: unknown;
}

export interface FilterRuleConfig {
  id: string;
  name?: string;
  enabled?: boolean;
  condition: FilterCondition;
  action: 'allow' | 'drop';
  composition?: 'AND' | 'OR' | 'NONE';
  priority?: number;
}

export interface FilterResult {
  matched: boolean;
  ruleId: string;
  ruleName?: string;
  reason: string;
}

export class FilterRuleMatcher {
  private rule: FilterRuleConfig;

  constructor(rule: FilterRuleConfig) {
    this.rule = rule;
  }

  match(data: unknown): boolean {
    const { field, operator, value } = this.rule.condition;

    try {
      const results: unknown = JSONPath({
        path: field,
        json: data as null | boolean | number | string | Record<string, unknown> | unknown[],
      });
      const resultArray: unknown[] = Array.isArray(results) ? results : [results];

      if (resultArray.length === 0) {
        return operator === 'not' || operator === 'exists';
      }

      const fieldValue = resultArray[0];

      switch (operator) {
        case 'equals':
          return fieldValue === value;
        case 'contains':
          if (typeof fieldValue === 'string') {
            return fieldValue.includes(String(value));
          }
          if (Array.isArray(fieldValue)) {
            return fieldValue.includes(value);
          }
          return false;
        case 'matches':
          if (typeof fieldValue === 'string' && typeof value === 'string') {
            return new RegExp(value).test(fieldValue);
          }
          return false;
        case 'exists':
          return true;
        case 'not':
          return fieldValue !== value;
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  evaluate(data: unknown): FilterResult {
    const matched = this.match(data);
    return {
      matched,
      ruleId: this.rule.id,
      ruleName: this.rule.name,
      reason: matched ? `Matched filter: ${this.rule.name || this.rule.id}` : 'No match',
    };
  }
}
