// Basic test to verify Jest and fast-check setup
import * as fc from 'fast-check';
import { Rule, isValidURLPattern, isValidHeaderName } from './index';

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

describe('URL Pattern Validation', () => {
  // Feature: chrome-request-manager, Property 2: URL pattern validation correctness
  // Validates: Requirements 1.2
  test('property: valid regex patterns should be accepted', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Valid regex patterns
          fc.constantFrom(
            '.*',
            'https://.*',
            'https://example\\.com/.*',
            '^https://api\\..*',
            'https://[a-z]+\\.com',
            '.*\\.json$',
            'https://example\\.com/(api|v1)/.*'
          ),
          // Valid wildcard patterns
          fc.constantFrom(
            '*',
            'https://*',
            'https://example.com/*',
            'https://*/api/*',
            'http://localhost:*/*'
          )
        ),
        (pattern) => {
          return isValidURLPattern(pattern);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('property: invalid patterns should be rejected', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Invalid regex patterns (unmatched brackets, etc.)
          'https://example.com/[',
          'https://example.com/(unclosed',
          'https://example.com/(?invalid',
          'https://example.com/(?P<invalid)',
          '[[[',
          '((('
        ),
        (pattern) => {
          return !isValidURLPattern(pattern);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('property: pattern validation is deterministic', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (pattern) => {
          const result1 = isValidURLPattern(pattern);
          const result2 = isValidURLPattern(pattern);
          return result1 === result2;
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Header Name Validation', () => {
  // Feature: chrome-request-manager, Property 6: Header name validation correctness
  // Validates: Requirements 2.2
  test('property: valid HTTP header names should be accepted', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'Content-Type',
          'Authorization',
          'X-Custom-Header',
          'Accept',
          'User-Agent',
          'Cache-Control',
          'X-API-Key',
          'Content-Length'
        ),
        (headerName) => {
          return isValidHeaderName(headerName);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('property: invalid header names should be rejected', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          '', // empty
          'Header Name', // space
          'Header:Name', // colon
          'Header=Name', // equals
          'Header/Name', // slash
          'Header\nName', // newline
          'Header\tName', // tab
          'Header Name!', // special char
          'Header@Name' // at sign
        ),
        (headerName) => {
          return !isValidHeaderName(headerName);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('property: header name validation is deterministic', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (headerName) => {
          const result1 = isValidHeaderName(headerName);
          const result2 = isValidHeaderName(headerName);
          return result1 === result2;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('property: header names are case-insensitive in validation', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'content-type',
          'Content-Type',
          'CONTENT-TYPE',
          'authorization',
          'Authorization',
          'AUTHORIZATION'
        ),
        (headerName) => {
          return isValidHeaderName(headerName);
        }
      ),
      { numRuns: 100 }
    );
  });
});
