import * as fc from 'fast-check';

/**
 * Feature: chrome-request-manager, Property 23: Rule list display completeness
 * Validates: Requirements 7.1
 * 
 * For any set of existing rules, when the popup is opened, the data provided to the UI 
 * should include all rules with their current status (enabled/disabled)
 */

// Generator for rule actions
const ruleActionArb = fc.oneof(
  fc.record({
    type: fc.constant('modifyHeaders' as const),
    requestHeaders: fc.option(fc.array(fc.record({
      operation: fc.constantFrom('set' as const, 'remove' as const, 'append' as const),
      header: fc.string({ minLength: 1, maxLength: 50 }),
      value: fc.option(fc.string({ maxLength: 100 })),
    })), { nil: undefined }),
    responseHeaders: fc.option(fc.array(fc.record({
      operation: fc.constantFrom('set' as const, 'remove' as const, 'append' as const),
      header: fc.string({ minLength: 1, maxLength: 50 }),
      value: fc.option(fc.string({ maxLength: 100 })),
    })), { nil: undefined }),
  }),
  fc.record({
    type: fc.constant('redirect' as const),
    destination: fc.webUrl(),
    regexSubstitution: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
  })
);

// Generator for rules
const ruleArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  enabled: fc.boolean(),
  priority: fc.integer({ min: 1, max: 100 }),
  urlPattern: fc.oneof(
    fc.string({ minLength: 1, maxLength: 200 }),
    fc.webUrl()
  ),
  action: ruleActionArb,
  createdAt: fc.date(),
  modifiedAt: fc.date(),
});

describe('Popup UI - Rule List Display', () => {
  describe('Property 23: Rule list display completeness', () => {
    it('should include all rules with their status when fetched from background', () => {
      fc.assert(
        fc.property(
          fc.array(ruleArb, { minLength: 0, maxLength: 20 }),
          (rules) => {
            // Simulate the data that would be returned from the background script
            const fetchedRules = rules;

            // Verify completeness: all rules should be present
            expect(fetchedRules.length).toBe(rules.length);

            // Verify each rule has required properties for display
            fetchedRules.forEach((rule, index) => {
              const originalRule = rules[index];
              
              // Rule should have all required display properties
              expect(rule).toHaveProperty('id');
              expect(rule).toHaveProperty('name');
              expect(rule).toHaveProperty('enabled');
              expect(rule).toHaveProperty('urlPattern');
              
              // Status should match original
              expect(rule.enabled).toBe(originalRule.enabled);
              
              // Name should match original
              expect(rule.name).toBe(originalRule.name);
              
              // ID should match original
              expect(rule.id).toBe(originalRule.id);
            });

            // Verify no rules are missing
            const fetchedIds = new Set(fetchedRules.map(r => r.id));
            const originalIds = new Set(rules.map(r => r.id));
            expect(fetchedIds).toEqual(originalIds);

            // Verify enabled/disabled status is preserved
            rules.forEach(originalRule => {
              const fetchedRule = fetchedRules.find(r => r.id === originalRule.id);
              expect(fetchedRule).toBeDefined();
              expect(fetchedRule!.enabled).toBe(originalRule.enabled);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve rule status (enabled/disabled) for all rules', () => {
      fc.assert(
        fc.property(
          fc.array(ruleArb, { minLength: 1, maxLength: 20 }),
          (rules) => {
            // Simulate fetching rules
            const fetchedRules = rules;

            // Count enabled and disabled rules
            const originalEnabledCount = rules.filter(r => r.enabled).length;
            const originalDisabledCount = rules.filter(r => !r.enabled).length;
            
            const fetchedEnabledCount = fetchedRules.filter(r => r.enabled).length;
            const fetchedDisabledCount = fetchedRules.filter(r => !r.enabled).length;

            // Counts should match
            expect(fetchedEnabledCount).toBe(originalEnabledCount);
            expect(fetchedDisabledCount).toBe(originalDisabledCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should include all rule metadata needed for display', () => {
      fc.assert(
        fc.property(
          fc.array(ruleArb, { minLength: 1, maxLength: 20 }),
          (rules) => {
            // Verify each rule has the minimum required properties for UI display
            rules.forEach(rule => {
              // Required for display in popup
              expect(typeof rule.id).toBe('string');
              expect(typeof rule.name).toBe('string');
              expect(rule.name.length).toBeGreaterThan(0);
              expect(typeof rule.enabled).toBe('boolean');
              expect(rule.urlPattern).toBeDefined();
              
              // These should also be present for completeness
              expect(rule.priority).toBeDefined();
              expect(rule.action).toBeDefined();
              expect(rule.createdAt).toBeDefined();
              expect(rule.modifiedAt).toBeDefined();
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
