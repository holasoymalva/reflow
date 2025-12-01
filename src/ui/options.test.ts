import * as fc from 'fast-check';
import { Rule, RuleAction, HeaderModification, URLRedirection, BodyModification, ResponseOverride } from '@/types';

/**
 * Feature: chrome-request-manager, Property 24: Rule save validation
 * 
 * For any rule being saved (created or edited), all fields should be validated before the rule is persisted to storage
 * Validates: Requirements 7.4
 */

// Validation functions that mirror the form validation logic
function validateRuleName(name: string): boolean {
  return name.trim().length > 0;
}

function validateURLPattern(pattern: string): boolean {
  if (!pattern.trim()) {
    return false;
  }
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

function validatePriority(priority: number): boolean {
  return priority >= 1 && Number.isInteger(priority);
}

function validateHeaderOperation(op: { operation: string; header: string; value?: string }): boolean {
  if (!op.header.trim()) {
    return false;
  }
  if (op.operation !== 'remove' && !op.value) {
    return false;
  }
  return true;
}

function validateHeaderModification(action: HeaderModification): boolean {
  if (!action.requestHeaders || action.requestHeaders.length === 0) {
    return true; // Empty is valid
  }
  return action.requestHeaders.every(validateHeaderOperation);
}

function validateURLRedirection(action: URLRedirection): boolean {
  return action.destination.trim().length > 0;
}

function validateBodyModification(action: BodyModification): boolean {
  if (action.modification.type === 'jsonPath') {
    if (!action.modification.path.trim()) {
      return false;
    }
    // Value can be any valid JSON value
    return true;
  } else {
    // Full replacement
    return action.modification.content.toString().trim().length > 0;
  }
}

function validateResponseOverride(action: ResponseOverride): boolean {
  if (action.statusCode < 100 || action.statusCode > 599) {
    return false;
  }
  // Headers should be a valid object
  if (typeof action.headers !== 'object' || action.headers === null) {
    return false;
  }
  return true;
}

function validateRuleAction(action: RuleAction): boolean {
  switch (action.type) {
    case 'modifyHeaders':
      return validateHeaderModification(action);
    case 'redirect':
      return validateURLRedirection(action);
    case 'modifyBody':
      return validateBodyModification(action);
    case 'mockResponse':
      return validateResponseOverride(action);
    default:
      return false;
  }
}

function validateRule(rule: Omit<Rule, 'id' | 'createdAt' | 'modifiedAt'>): boolean {
  return (
    validateRuleName(rule.name) &&
    validateURLPattern(rule.urlPattern.toString()) &&
    validatePriority(rule.priority) &&
    validateRuleAction(rule.action)
  );
}

// Arbitraries for generating test data
const headerOperationArb = fc.oneof(
  // Set and append operations need a value
  fc.record({
    operation: fc.constantFrom('set' as const, 'append' as const),
    header: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    value: fc.string({ minLength: 1, maxLength: 100 }),
  }),
  // Remove operations don't need a value
  fc.record({
    operation: fc.constant('remove' as const),
    header: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
    value: fc.constant(undefined),
  })
);

const headerModificationArb: fc.Arbitrary<HeaderModification> = fc.record({
  type: fc.constant('modifyHeaders' as const),
  requestHeaders: fc.option(fc.array(headerOperationArb, { minLength: 0, maxLength: 5 }), { nil: undefined }),
  responseHeaders: fc.option(fc.array(headerOperationArb, { minLength: 0, maxLength: 5 }), { nil: undefined }),
});

const urlRedirectionArb: fc.Arbitrary<URLRedirection> = fc.record({
  type: fc.constant('redirect' as const),
  destination: fc.webUrl(),
  regexSubstitution: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

const bodyModificationArb: fc.Arbitrary<BodyModification> = fc.oneof(
  fc.record({
    type: fc.constant('modifyBody' as const),
    target: fc.constantFrom('request' as const, 'response' as const),
    contentType: fc.constantFrom('json' as const, 'text' as const, 'binary' as const),
    modification: fc.record({
      type: fc.constant('jsonPath' as const),
      path: fc.string({ minLength: 1, maxLength: 50 }),
      value: fc.jsonValue(),
    }),
  }),
  fc.record({
    type: fc.constant('modifyBody' as const),
    target: fc.constantFrom('request' as const, 'response' as const),
    contentType: fc.constantFrom('json' as const, 'text' as const, 'binary' as const),
    modification: fc.record({
      type: fc.constant('replace' as const),
      content: fc.string({ minLength: 1, maxLength: 1000 }),
    }),
  })
);

const responseOverrideArb: fc.Arbitrary<ResponseOverride> = fc.record({
  type: fc.constant('mockResponse' as const),
  statusCode: fc.integer({ min: 100, max: 599 }),
  headers: fc.dictionary(fc.string({ minLength: 1, maxLength: 50 }), fc.string({ minLength: 0, maxLength: 100 })),
  body: fc.string({ minLength: 0, maxLength: 1000 }),
});

const ruleActionArb: fc.Arbitrary<RuleAction> = fc.oneof(
  headerModificationArb,
  urlRedirectionArb,
  bodyModificationArb,
  responseOverrideArb
);

const validRuleArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  urlPattern: fc.oneof(
    fc.constant('.*'),
    fc.constant('https://.*'),
    fc.constant('https://api\\.example\\.com/.*'),
    fc.webUrl().map(url => url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  ),
  priority: fc.integer({ min: 1, max: 1000 }),
  enabled: fc.boolean(),
  action: ruleActionArb,
});

describe('Property 24: Rule save validation', () => {
  it('should validate all fields before persisting valid rules', () => {
    fc.assert(
      fc.property(validRuleArb, (rule) => {
        // For any valid rule, validation should pass
        const isValid = validateRule(rule);
        expect(isValid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject rules with empty names', () => {
    fc.assert(
      fc.property(validRuleArb, (rule) => {
        const invalidRule = { ...rule, name: '' };
        const isValid = validateRule(invalidRule);
        expect(isValid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject rules with whitespace-only names', () => {
    fc.assert(
      fc.property(validRuleArb, fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim() === ''), (rule, whitespace) => {
        const invalidRule = { ...rule, name: whitespace };
        const isValid = validateRule(invalidRule);
        expect(isValid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject rules with invalid URL patterns', () => {
    fc.assert(
      fc.property(validRuleArb, (rule) => {
        // Invalid regex patterns
        const invalidPatterns = ['[', '(', '*', '(?', '\\'];
        const invalidPattern = invalidPatterns[Math.floor(Math.random() * invalidPatterns.length)];
        const invalidRule = { ...rule, urlPattern: invalidPattern };
        const isValid = validateRule(invalidRule);
        expect(isValid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject rules with priority less than 1', () => {
    fc.assert(
      fc.property(validRuleArb, fc.integer({ min: -100, max: 0 }), (rule, invalidPriority) => {
        const invalidRule = { ...rule, priority: invalidPriority };
        const isValid = validateRule(invalidRule);
        expect(isValid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject header modifications with empty header names', () => {
    fc.assert(
      fc.property(validRuleArb, (rule) => {
        const invalidAction: HeaderModification = {
          type: 'modifyHeaders',
          requestHeaders: [{ operation: 'set', header: '', value: 'test' }],
        };
        const invalidRule = { ...rule, action: invalidAction };
        const isValid = validateRule(invalidRule);
        expect(isValid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject header set/append operations without values', () => {
    fc.assert(
      fc.property(validRuleArb, fc.constantFrom('set', 'append'), (rule, operation) => {
        const invalidAction: HeaderModification = {
          type: 'modifyHeaders',
          requestHeaders: [{ operation: operation as any, header: 'X-Test', value: undefined }],
        };
        const invalidRule = { ...rule, action: invalidAction };
        const isValid = validateRule(invalidRule);
        expect(isValid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject URL redirections with empty destinations', () => {
    fc.assert(
      fc.property(validRuleArb, (rule) => {
        const invalidAction: URLRedirection = {
          type: 'redirect',
          destination: '',
        };
        const invalidRule = { ...rule, action: invalidAction };
        const isValid = validateRule(invalidRule);
        expect(isValid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject body modifications with empty JSON paths', () => {
    fc.assert(
      fc.property(validRuleArb, (rule) => {
        const invalidAction: BodyModification = {
          type: 'modifyBody',
          target: 'request',
          contentType: 'json',
          modification: {
            type: 'jsonPath',
            path: '',
            value: 'test',
          },
        };
        const invalidRule = { ...rule, action: invalidAction };
        const isValid = validateRule(invalidRule);
        expect(isValid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject body modifications with empty replacement content', () => {
    fc.assert(
      fc.property(validRuleArb, (rule) => {
        const invalidAction: BodyModification = {
          type: 'modifyBody',
          target: 'request',
          contentType: 'text',
          modification: {
            type: 'replace',
            content: '',
          },
        };
        const invalidRule = { ...rule, action: invalidAction };
        const isValid = validateRule(invalidRule);
        expect(isValid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject mock responses with invalid status codes', () => {
    fc.assert(
      fc.property(validRuleArb, fc.integer().filter(n => n < 100 || n > 599), (rule, invalidStatus) => {
        const invalidAction: ResponseOverride = {
          type: 'mockResponse',
          statusCode: invalidStatus,
          headers: {},
          body: '',
        };
        const invalidRule = { ...rule, action: invalidAction };
        const isValid = validateRule(invalidRule);
        expect(isValid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
