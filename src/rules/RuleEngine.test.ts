import * as fc from 'fast-check';
import { RuleEngine, RequestInfo } from './RuleEngine';
import { Rule, HeaderModification } from '../types';

describe('RuleEngine', () => {
  let engine: RuleEngine;

  beforeEach(() => {
    engine = new RuleEngine();
  });

  // Feature: chrome-request-manager, Property 3: Rule activation state effect
  // Validates: Requirements 1.3, 1.4
  describe('Property 3: Rule activation state effect', () => {
    it('should apply rule if and only if rule is enabled', () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.string(),
            name: fc.string(),
            priority: fc.integer({ min: 1, max: 100 }),
            urlPattern: fc.constantFrom('*', 'https://*', 'http://example.com/*'),
            enabled: fc.boolean(),
            createdAt: fc.date(),
            modifiedAt: fc.date(),
            action: fc.constant<HeaderModification>({
              type: 'modifyHeaders',
              requestHeaders: [{
                operation: 'set',
                header: 'X-Test-Header',
                value: 'test-value'
              }]
            })
          }),
          fc.record({
            url: fc.constantFrom('https://example.com', 'http://example.com/test', 'https://test.com'),
            method: fc.constantFrom('GET', 'POST', 'PUT'),
            headers: fc.constant({})
          }),
          (rule: Rule, request: RequestInfo) => {
            const matches = engine.evaluateRule(rule, request);
            
            // Rule should match if enabled and URL pattern matches
            // Rule should not match if disabled, regardless of URL pattern
            if (!rule.enabled) {
              expect(matches).toBe(false);
            }
            
            // If enabled, check if it actually matches the pattern
            if (rule.enabled && matches) {
              // Apply the rule and verify modifications were made
              const modified = engine.applyRule(rule, request);
              
              if (rule.action.type === 'modifyHeaders') {
                // Should have modifications
                expect(modified.modifications.length).toBeGreaterThan(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 7: Rule priority ordering
  // Validates: Requirements 2.4
  describe('Property 7: Rule priority ordering', () => {
    it('should sort rules in descending priority order (higher priority first)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.string(),
              name: fc.string(),
              priority: fc.integer({ min: 1, max: 1000 }),
              urlPattern: fc.constant('*'),
              enabled: fc.constant(true),
              createdAt: fc.date(),
              modifiedAt: fc.date(),
              action: fc.constant<HeaderModification>({
                type: 'modifyHeaders',
                requestHeaders: []
              })
            }),
            { minLength: 2, maxLength: 20 }
          ),
          (rules: Rule[]) => {
            const sorted = engine.sortByPriority(rules);
            
            // Verify sorted in descending order
            for (let i = 0; i < sorted.length - 1; i++) {
              expect(sorted[i].priority).toBeGreaterThanOrEqual(sorted[i + 1].priority);
            }
            
            // Verify all rules are present
            expect(sorted.length).toBe(rules.length);
            
            // Verify no rules were lost or duplicated
            const originalIds = rules.map(r => r.id).sort();
            const sortedIds = sorted.map(r => r.id).sort();
            expect(sortedIds).toEqual(originalIds);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 5: Header modification completeness
  // Validates: Requirements 2.1, 2.3
  describe('Property 5: Header modification completeness', () => {
    it('should apply all specified header operations (set, remove, append)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              operation: fc.constantFrom('set', 'remove', 'append') as fc.Arbitrary<'set' | 'remove' | 'append'>,
              header: fc.constantFrom('X-Custom-Header', 'X-Test', 'X-Api-Key'),
              value: fc.string({ minLength: 1, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.record({
            url: fc.constant('https://example.com'),
            method: fc.constant('GET'),
            headers: fc.constant({ 'X-Custom-Header': 'original-value', 'X-Test': 'test-value' })
          }),
          (operations, request: RequestInfo) => {
            const action: HeaderModification = {
              type: 'modifyHeaders',
              requestHeaders: operations
            };

            const modified = engine.applyHeaderModifications(action, {
              url: request.url,
              method: request.method,
              headers: { ...request.headers },
              modifications: []
            });

            // Count non-restricted operations
            const nonRestrictedOps = operations.filter(op => 
              !['host', 'connection', 'content-length', 'cookie', 'origin', 'referer', 'user-agent'].includes(op.header.toLowerCase())
            );

            // Each non-restricted operation should result in a modification entry
            const modificationCount = modified.modifications.filter(m => 
              !m.includes('Skipped restricted')
            ).length;

            expect(modificationCount).toBe(nonRestrictedOps.length);

            // Verify the final state reflects all operations applied in sequence
            // We need to simulate what the final state should be
            const expectedHeaders = { ...request.headers };
            for (const op of nonRestrictedOps) {
              switch (op.operation) {
                case 'set':
                  expectedHeaders[op.header] = op.value;
                  break;
                case 'remove':
                  delete expectedHeaders[op.header];
                  break;
                case 'append':
                  if (expectedHeaders[op.header]) {
                    expectedHeaders[op.header] += `, ${op.value}`;
                  } else {
                    expectedHeaders[op.header] = op.value;
                  }
                  break;
              }
            }

            // Verify the modified headers match expected state
            expect(modified.headers).toEqual(expectedHeaders);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 8: Security conflict handling
  // Validates: Requirements 2.5
  describe('Property 8: Security conflict handling', () => {
    it('should skip restricted headers and log conflicts', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              operation: fc.constantFrom('set', 'remove', 'append') as fc.Arbitrary<'set' | 'remove' | 'append'>,
              header: fc.constantFrom('Host', 'Cookie', 'Origin', 'User-Agent', 'Connection', 'X-Safe-Header'),
              value: fc.string({ minLength: 1, maxLength: 20 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.record({
            url: fc.constant('https://example.com'),
            method: fc.constant('GET'),
            headers: fc.constant({ 'Host': 'example.com', 'X-Safe-Header': 'safe' })
          }),
          (operations, request: RequestInfo) => {
            const action: HeaderModification = {
              type: 'modifyHeaders',
              requestHeaders: operations
            };

            const initialHeaders = { ...request.headers };
            const modified = engine.applyHeaderModifications(action, {
              url: request.url,
              method: request.method,
              headers: { ...request.headers },
              modifications: []
            });

            // Identify restricted operations
            const restrictedOps = operations.filter(op => 
              ['host', 'connection', 'content-length', 'cookie', 'cookie2', 'set-cookie', 
               'set-cookie2', 'origin', 'referer', 'user-agent', 'proxy-authorization',
               'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'via']
                .includes(op.header.toLowerCase())
            );

            // Each restricted operation should be logged as skipped
            for (const op of restrictedOps) {
              const hasSkipLog = modified.modifications.some(m => 
                m.includes('Skipped restricted') && m.toLowerCase().includes(op.header.toLowerCase())
              );
              expect(hasSkipLog).toBe(true);
            }

            // Verify restricted headers were not modified
            for (const op of restrictedOps) {
              if (initialHeaders[op.header]) {
                // If header existed initially, it should remain unchanged
                expect(modified.headers[op.header]).toBe(initialHeaders[op.header]);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 9: URL redirection correctness
  // Validates: Requirements 3.1, 3.2
  describe('Property 9: URL redirection correctness', () => {
    it('should redirect to the specified destination (static or regex-based)', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Static URL redirection
            fc.record({
              type: fc.constant('static' as const),
              destination: fc.constantFrom(
                'https://redirect.example.com',
                'http://localhost:3000',
                'https://api.example.com/v2'
              )
            }),
            // Regex-based redirection
            fc.record({
              type: fc.constant('regex' as const),
              pattern: fc.constant('example\\.com'),
              replacement: fc.constant('redirect.example.com')
            })
          ),
          fc.record({
            url: fc.constantFrom(
              'https://example.com/path',
              'http://example.com/api',
              'https://test.example.com'
            ),
            method: fc.constant('GET'),
            headers: fc.constant({})
          }),
          (redirectConfig, request: RequestInfo) => {
            let action;
            let expectedURL;

            if (redirectConfig.type === 'static') {
              action = {
                type: 'redirect' as const,
                destination: redirectConfig.destination
              };
              expectedURL = redirectConfig.destination;
            } else {
              action = {
                type: 'redirect' as const,
                destination: redirectConfig.pattern,
                regexSubstitution: redirectConfig.replacement
              };
              expectedURL = request.url.replace(
                new RegExp(redirectConfig.pattern),
                redirectConfig.replacement
              );
            }

            const modified = engine.applyURLRedirection(action, {
              url: request.url,
              method: request.method,
              headers: { ...request.headers },
              modifications: []
            }, request);

            // Verify URL was redirected correctly
            if (!modified.modifications.some((m: string) => m.includes('Error'))) {
              expect(modified.url).toBe(expectedURL);
              expect(modified.modifications.some((m: string) => m.includes('Redirected to'))).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 10: URL modification invariant preservation
  // Validates: Requirements 3.3
  describe('Property 10: URL modification invariant preservation', () => {
    it('should preserve request method and body when URL is modified', () => {
      fc.assert(
        fc.property(
          fc.record({
            url: fc.constantFrom('https://example.com/path', 'http://api.example.com'),
            method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
            headers: fc.constant({}),
            body: fc.oneof(
              fc.constant(undefined),
              fc.string({ minLength: 1, maxLength: 100 })
            )
          }),
          (request: RequestInfo) => {
            const action = {
              type: 'redirect' as const,
              destination: 'https://redirect.example.com'
            };

            const originalMethod = request.method;
            const originalBody = request.body;

            const modified = engine.applyURLRedirection(action, {
              url: request.url,
              method: request.method,
              headers: { ...request.headers },
              body: request.body,
              modifications: []
            }, request);

            // Verify method and body are preserved
            expect(modified.method).toBe(originalMethod);
            expect(modified.body).toBe(originalBody);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 11: Invalid URL modification fallback
  // Validates: Requirements 3.4
  describe('Property 11: Invalid URL modification fallback', () => {
    it('should keep original URL and log error when modification creates invalid URL', () => {
      fc.assert(
        fc.property(
          fc.record({
            url: fc.constantFrom('https://example.com/path', 'http://api.example.com'),
            method: fc.constant('GET'),
            headers: fc.constant({})
          }),
          fc.constantFrom(
            'not-a-valid-url',
            '://invalid',
            'ht!tp://bad',
            ''
          ),
          (request: RequestInfo, invalidDestination: string) => {
            const action = {
              type: 'redirect' as const,
              destination: invalidDestination
            };

            const originalURL = request.url;

            const modified = engine.applyURLRedirection(action, {
              url: request.url,
              method: request.method,
              headers: { ...request.headers },
              modifications: []
            }, request);

            // Verify original URL is preserved
            expect(modified.url).toBe(originalURL);
            
            // Verify error was logged
            const hasErrorLog = modified.modifications.some((m: string) => 
              m.includes('Error') && m.includes('Invalid URL')
            );
            expect(hasErrorLog).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 12: Body modification application
  // Validates: Requirements 4.1, 4.2
  describe('Property 12: Body modification application', () => {
    it('should modify body content for JSON, text, and binary types', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // JSON modification
            fc.record({
              contentType: fc.constant('json' as const),
              body: fc.constant('{"name":"test","value":123}'),
              modification: fc.constant({
                type: 'replace' as const,
                content: '{"name":"modified","value":456}'
              })
            }),
            // Text modification
            fc.record({
              contentType: fc.constant('text' as const),
              body: fc.string({ minLength: 1, maxLength: 100 }),
              modification: fc.record({
                type: fc.constant('replace' as const),
                content: fc.string({ minLength: 1, maxLength: 50 })
              })
            }),
            // Binary modification
            fc.record({
              contentType: fc.constant('binary' as const),
              body: fc.constant('binary data'),
              modification: fc.record({
                type: fc.constant('replace' as const),
                content: fc.constant('new binary data')
              })
            })
          ),
          (testCase) => {
            const action = {
              type: 'modifyBody' as const,
              target: 'request' as const,
              contentType: testCase.contentType,
              modification: testCase.modification
            };

            const modified = engine.applyBodyModification(action, {
              url: 'https://example.com',
              method: 'POST',
              headers: {},
              body: testCase.body,
              modifications: []
            });

            // Verify body was modified
            expect(modified.body).toBeDefined();
            expect(modified.body).not.toBe(testCase.body);
            
            // Verify modification was logged
            expect(modified.modifications.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 13: Body modification content-length consistency
  // Validates: Requirements 4.3
  describe('Property 13: Body modification content-length consistency', () => {
    it('should update Content-Length header to match modified body size', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // JSON modification with valid JSON
            fc.record({
              contentType: fc.constant('json' as const),
              body: fc.constant('{"name":"test"}'),
              modification: fc.record({
                type: fc.constant('replace' as const),
                content: fc.constantFrom(
                  '{"data":"modified"}',
                  '{"value":123,"name":"test"}',
                  '{"array":[1,2,3]}'
                )
              })
            }),
            // Text modification
            fc.record({
              contentType: fc.constant('text' as const),
              body: fc.string({ minLength: 1, maxLength: 50 }),
              modification: fc.record({
                type: fc.constant('replace' as const),
                content: fc.string({ minLength: 1, maxLength: 100 })
              })
            })
          ),
          (testCase) => {
            const action = {
              type: 'modifyBody' as const,
              target: 'response' as const,
              contentType: testCase.contentType,
              modification: testCase.modification
            };

            const modified = engine.applyBodyModification(action, {
              url: 'https://example.com',
              method: 'POST',
              headers: {},
              body: testCase.body,
              modifications: []
            });

            // Only check Content-Length if modification succeeded (no error in modifications)
            const hasError = modified.modifications.some((m: string) => m.includes('Error'));
            if (!hasError && modified.body) {
              // Calculate expected Content-Length
              const bodyStr = typeof modified.body === 'string' 
                ? modified.body 
                : new TextDecoder().decode(modified.body as ArrayBuffer);
              const expectedLength = new TextEncoder().encode(bodyStr).length;

              // Verify Content-Length header matches body size
              expect(modified.headers['Content-Length']).toBe(String(expectedLength));
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 14: JSON path modification precision
  // Validates: Requirements 4.4
  describe('Property 14: JSON path modification precision', () => {
    it('should modify only the targeted JSON path, leaving other parts unchanged', () => {
      fc.assert(
        fc.property(
          fc.record({
            path: fc.constantFrom('user.name', 'config.timeout', 'data.value'),
            newValue: fc.oneof(fc.string(), fc.integer(), fc.boolean())
          }),
          (testCase) => {
            const originalBody = {
              user: { name: 'original', email: 'test@example.com' },
              config: { timeout: 5000, retries: 3 },
              data: { value: 100, status: 'active' }
            };

            const action = {
              type: 'modifyBody' as const,
              target: 'request' as const,
              contentType: 'json' as const,
              modification: {
                type: 'jsonPath' as const,
                path: testCase.path,
                value: testCase.newValue
              }
            };

            const modified = engine.applyBodyModification(action, {
              url: 'https://example.com',
              method: 'POST',
              headers: {},
              body: JSON.stringify(originalBody),
              modifications: []
            });

            // Parse the modified body
            const modifiedBody = JSON.parse(modified.body as string);

            // Verify the targeted path was modified
            const pathParts = testCase.path.split('.');
            let current: any = modifiedBody;
            for (let i = 0; i < pathParts.length - 1; i++) {
              current = current[pathParts[i]];
            }
            expect(current[pathParts[pathParts.length - 1]]).toBe(testCase.newValue);

            // Verify other paths remain unchanged
            if (testCase.path !== 'user.name') {
              expect(modifiedBody.user.name).toBe('original');
            }
            if (testCase.path !== 'user.email') {
              expect(modifiedBody.user.email).toBe('test@example.com');
            }
            if (testCase.path !== 'config.timeout') {
              expect(modifiedBody.config.timeout).toBe(5000);
            }
            if (testCase.path !== 'config.retries') {
              expect(modifiedBody.config.retries).toBe(3);
            }
            if (testCase.path !== 'data.value') {
              expect(modifiedBody.data.value).toBe(100);
            }
            if (testCase.path !== 'data.status') {
              expect(modifiedBody.data.status).toBe('active');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
