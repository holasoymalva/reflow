// Basic test to verify Jest and fast-check setup
import * as fc from 'fast-check';
import { Rule } from './index';

describe('Testing Framework Setup', () => {
  test('Jest is working', () => {
    expect(true).toBe(true);
  });

  test('fast-check is working', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        return n === n;
      }),
      { numRuns: 100 }
    );
  });

  test('TypeScript types are available', () => {
    const rule: Partial<Rule> = {
      id: 'test-id',
      name: 'Test Rule',
      enabled: true
    };
    expect(rule.id).toBe('test-id');
  });
});
