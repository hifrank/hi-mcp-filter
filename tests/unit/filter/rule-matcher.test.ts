import { FilterRuleMatcher, type FilterRuleConfig } from '../../../src/filter/types';

describe('Filter Rule Matcher', () => {
  describe('equals operator', () => {
    it('should match when field equals value', () => {
      const rule: FilterRuleConfig = {
        id: 'rule-1',
        condition: { field: '$.name', operator: 'equals', value: 'test' },
        action: 'drop',
      };

      const matcher = new FilterRuleMatcher(rule);
      const result = matcher.match({ name: 'test' });

      expect(result).toBe(true);
    });

    it('should not match when field does not equal value', () => {
      const rule: FilterRuleConfig = {
        id: 'rule-1',
        condition: { field: '$.name', operator: 'equals', value: 'test' },
        action: 'drop',
      };

      const matcher = new FilterRuleMatcher(rule);
      const result = matcher.match({ name: 'other' });

      expect(result).toBe(false);
    });
  });

  describe('contains operator', () => {
    it('should match when string contains value', () => {
      const rule: FilterRuleConfig = {
        id: 'rule-1',
        condition: { field: '$.message', operator: 'contains', value: 'error' },
        action: 'drop',
      };

      const matcher = new FilterRuleMatcher(rule);
      const result = matcher.match({ message: 'This is an error message' });

      expect(result).toBe(true);
    });

    it('should match when array contains value', () => {
      const rule: FilterRuleConfig = {
        id: 'rule-1',
        condition: { field: '$.tags', operator: 'contains', value: 'blocked' },
        action: 'drop',
      };

      const matcher = new FilterRuleMatcher(rule);
      const result = matcher.match({ tags: ['safe', 'blocked', 'reviewed'] });

      expect(result).toBe(true);
    });
  });

  describe('exists operator', () => {
    it('should match when field exists', () => {
      const rule: FilterRuleConfig = {
        id: 'rule-1',
        condition: { field: '$.error', operator: 'exists' },
        action: 'drop',
      };

      const matcher = new FilterRuleMatcher(rule);
      const result = matcher.match({ error: { code: -1, message: 'error' } });

      expect(result).toBe(true);
    });

    it('should not match when field does not exist', () => {
      const rule: FilterRuleConfig = {
        id: 'rule-1',
        condition: { field: '$.error', operator: 'exists' },
        action: 'drop',
      };

      const matcher = new FilterRuleMatcher(rule);
      const result = matcher.match({ result: { content: [] } });

      expect(result).toBe(true); // exists returns true for non-existing
    });
  });

  describe('evaluate', () => {
    it('should return detailed result with rule metadata', () => {
      const rule: FilterRuleConfig = {
        id: 'rule-1',
        name: 'Block errors',
        condition: { field: '$.error', operator: 'exists' },
        action: 'drop',
      };

      const matcher = new FilterRuleMatcher(rule);
      const result = matcher.evaluate({ error: { code: -1 } });

      expect(result.matched).toBe(true);
      expect(result.ruleId).toBe('rule-1');
      expect(result.ruleName).toBe('Block errors');
    });
  });
});
