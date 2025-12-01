import * as fc from 'fast-check';
import { Logger } from './Logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
  });

  afterEach(async () => {
    await logger.clearLogs();
  });

  // Arbitraries for property-based testing
  const headerArb = fc.dictionary(
    fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9\-]+$/.test(s)),
    fc.string({ maxLength: 100 })
  );

  const requestInfoArb = fc.record({
    url: fc.webUrl(),
    method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'),
    headers: headerArb,
    timestamp: fc.date()
  });

  const ruleActionArb = fc.oneof(
    fc.record({
      type: fc.constant('modifyHeaders' as const),
      requestHeaders: fc.option(fc.array(fc.record({
        operation: fc.constantFrom('set' as const, 'remove' as const, 'append' as const),
        header: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9\-]+$/.test(s)),
        value: fc.option(fc.string({ maxLength: 50 }), { nil: undefined })
      }), { maxLength: 5 }), { nil: undefined }),
      responseHeaders: fc.option(fc.array(fc.record({
        operation: fc.constantFrom('set' as const, 'remove' as const, 'append' as const),
        header: fc.string({ minLength: 1, maxLength: 20 }).filter(s => /^[a-zA-Z0-9\-]+$/.test(s)),
        value: fc.option(fc.string({ maxLength: 50 }), { nil: undefined })
      }), { maxLength: 5 }), { nil: undefined })
    }),
    fc.record({
      type: fc.constant('redirect' as const),
      destination: fc.webUrl(),
      regexSubstitution: fc.option(fc.string({ maxLength: 50 }), { nil: undefined })
    }),
    fc.record({
      type: fc.constant('modifyBody' as const),
      target: fc.constantFrom('request' as const, 'response' as const),
      contentType: fc.constantFrom('json' as const, 'text' as const, 'binary' as const),
      modification: fc.oneof(
        fc.record({
          type: fc.constant('jsonPath' as const),
          path: fc.string({ minLength: 1, maxLength: 50 }),
          value: fc.anything()
        }),
        fc.record({
          type: fc.constant('replace' as const),
          content: fc.string({ maxLength: 100 })
        })
      )
    }),
    fc.record({
      type: fc.constant('mockResponse' as const),
      statusCode: fc.integer({ min: 200, max: 599 }),
      headers: fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ maxLength: 50 })),
      body: fc.string({ maxLength: 100 })
    })
  );

  const ruleArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    enabled: fc.boolean(),
    priority: fc.integer({ min: 1, max: 100 }),
    urlPattern: fc.string({ minLength: 1, maxLength: 100 }),
    action: ruleActionArb,
    createdAt: fc.date(),
    modifiedAt: fc.date()
  });

  const httpsRequestInfoArb = fc.record({
    url: fc.string().map(s => `https://example.com/${s}`),
    method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'),
    headers: fc.dictionary(
      fc.constantFrom('authorization', 'cookie', 'set-cookie', 'Authorization', 'Cookie', 'X-API-Key', 'Content-Type', 'User-Agent'),
      fc.string({ maxLength: 100 })
    ),
    timestamp: fc.date()
  });

  // Feature: chrome-request-manager, Property 15: Request log completeness
  // **Validates: Requirements 5.1, 5.2**
  describe('Property 15: Request log completeness', () => {
    it('should log all required fields and applied rules with modifications', async () => {
      await fc.assert(
        fc.asyncProperty(
          requestInfoArb,
          fc.array(ruleArb, { minLength: 0, maxLength: 5 }),
          async (request, appliedRules) => {
            // Create a fresh logger for each test iteration
            const testLogger = new Logger();
            
            // Log the request
            testLogger.logRequest(request, appliedRules);

            // Get all logs
            const logs = await testLogger.getLogs();

            // Should have exactly one log entry
            expect(logs).toHaveLength(1);

            const logEntry = logs[0];

            // Verify all required fields are present
            expect(logEntry.id).toBeDefined();
            expect(typeof logEntry.id).toBe('string');
            
            expect(logEntry.timestamp).toBeInstanceOf(Date);
            expect(logEntry.timestamp.getTime()).toBe(request.timestamp.getTime());
            
            expect(logEntry.url).toBe(request.url);
            expect(logEntry.method).toBe(request.method);
            
            expect(logEntry.requestHeaders).toBeDefined();
            expect(typeof logEntry.requestHeaders).toBe('object');
            
            // Verify applied rules are recorded
            expect(logEntry.appliedRules).toBeDefined();
            expect(Array.isArray(logEntry.appliedRules)).toBe(true);
            expect(logEntry.appliedRules).toHaveLength(appliedRules.length);
            
            // Verify all rule IDs are present
            for (const rule of appliedRules) {
              expect(logEntry.appliedRules).toContain(rule.id);
            }

            // Verify modifications are recorded
            expect(logEntry.modifications).toBeDefined();
            expect(Array.isArray(logEntry.modifications)).toBe(true);
            
            // If rules were applied, modifications should be present
            // Note: A rule might not produce modifications if it has no actual operations
            // (e.g., modifyHeaders with both requestHeaders and responseHeaders undefined)
            const rulesWithActualModifications = appliedRules.filter(rule => {
              if (rule.action.type === 'modifyHeaders') {
                return (rule.action.requestHeaders && rule.action.requestHeaders.length > 0) ||
                       (rule.action.responseHeaders && rule.action.responseHeaders.length > 0);
              }
              return true; // Other action types always produce modifications
            });
            
            if (rulesWithActualModifications.length > 0) {
              expect(logEntry.modifications.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 16: Log chronological ordering
  // **Validates: Requirements 5.3**
  describe('Property 16: Log chronological ordering', () => {
    it('should return logs in chronological order by timestamp', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(requestInfoArb, { minLength: 2, maxLength: 20 }),
          async (requests) => {
            // Create a fresh logger for each test iteration
            const testLogger = new Logger();
            
            // Log all requests
            for (const request of requests) {
              testLogger.logRequest(request, []);
            }

            // Get all logs
            const logs = await testLogger.getLogs();

            // Verify logs are in chronological order
            for (let i = 1; i < logs.length; i++) {
              const prevTimestamp = logs[i - 1].timestamp.getTime();
              const currTimestamp = logs[i].timestamp.getTime();
              
              // Current timestamp should be >= previous timestamp (chronological order)
              expect(currTimestamp).toBeGreaterThanOrEqual(prevTimestamp);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 26: HTTPS sensitive data protection
  // **Validates: Requirements 8.3**
  describe('Property 26: HTTPS sensitive data protection', () => {
    it('should filter sensitive headers from HTTPS requests in logs', async () => {
      await fc.assert(
        fc.asyncProperty(
          httpsRequestInfoArb,
          fc.array(ruleArb, { minLength: 0, maxLength: 3 }),
          async (request, appliedRules) => {
            // Create a fresh logger for each test iteration
            const testLogger = new Logger();
            
            // Log the HTTPS request
            testLogger.logRequest(request, appliedRules);

            // Get all logs
            const logs = await testLogger.getLogs();

            // Should have exactly one log entry
            expect(logs).toHaveLength(1);

            const logEntry = logs[0];

            // Verify sensitive headers are filtered
            const sensitiveHeaders = ['authorization', 'cookie', 'set-cookie', 'proxy-authorization', 'www-authenticate', 'x-api-key', 'api-key'];
            
            for (const [headerName, headerValue] of Object.entries(request.headers)) {
              const lowerHeaderName = headerName.toLowerCase();
              
              if (sensitiveHeaders.includes(lowerHeaderName)) {
                // Sensitive header should be filtered
                expect(logEntry.requestHeaders[headerName]).toBe('[FILTERED]');
              } else {
                // Non-sensitive header should be preserved
                expect(logEntry.requestHeaders[headerName]).toBe(headerValue);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Unit tests for log retention and cleanup
  describe('Log retention and cleanup', () => {
    it('should clear all logs when no date is provided', async () => {
      const testLogger = new Logger();
      
      // Add some logs
      testLogger.logRequest({ url: 'https://test1.com', method: 'GET', headers: {}, timestamp: new Date() }, []);
      testLogger.logRequest({ url: 'https://test2.com', method: 'GET', headers: {}, timestamp: new Date() }, []);
      
      expect((await testLogger.getLogs()).length).toBe(2);
      
      // Clear all logs
      await testLogger.clearLogs();
      
      expect((await testLogger.getLogs()).length).toBe(0);
    });

    it('should clear logs older than specified date', async () => {
      const testLogger = new Logger();
      
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      
      testLogger.logRequest({ url: 'https://old.com', method: 'GET', headers: {}, timestamp: twoDaysAgo }, []);
      testLogger.logRequest({ url: 'https://recent.com', method: 'GET', headers: {}, timestamp: now }, []);
      
      expect((await testLogger.getLogs()).length).toBe(2);
      
      // Clear logs older than yesterday
      await testLogger.clearLogs(yesterday);
      
      const remainingLogs = await testLogger.getLogs();
      expect(remainingLogs.length).toBe(1);
      expect(remainingLogs[0].url).toBe('https://recent.com');
    });

    it('should apply retention policy based on days', async () => {
      const testLogger = new Logger();
      
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      
      testLogger.logRequest({ url: 'https://old.com', method: 'GET', headers: {}, timestamp: threeDaysAgo }, []);
      testLogger.logRequest({ url: 'https://recent.com', method: 'GET', headers: {}, timestamp: oneDayAgo }, []);
      testLogger.logRequest({ url: 'https://now.com', method: 'GET', headers: {}, timestamp: now }, []);
      
      expect((await testLogger.getLogs()).length).toBe(3);
      
      // Apply retention policy: keep logs from last 2 days
      await testLogger.applyRetentionPolicy(2, 1000);
      
      const remainingLogs = await testLogger.getLogs();
      expect(remainingLogs.length).toBe(2);
      expect(remainingLogs.some(log => log.url === 'https://old.com')).toBe(false);
    });

    it('should limit logs to max entries', async () => {
      const testLogger = new Logger();
      
      const now = new Date();
      
      // Add 10 logs
      for (let i = 0; i < 10; i++) {
        testLogger.logRequest({ 
          url: `https://test${i}.com`, 
          method: 'GET', 
          headers: {}, 
          timestamp: new Date(now.getTime() + i * 1000) 
        }, []);
      }
      
      expect((await testLogger.getLogs()).length).toBe(10);
      
      // Apply retention policy: keep only 5 most recent logs
      await testLogger.applyRetentionPolicy(365, 5);
      
      const remainingLogs = await testLogger.getLogs();
      expect(remainingLogs.length).toBe(5);
      
      // Should keep the most recent logs (test5-test9)
      expect(remainingLogs[0].url).toBe('https://test5.com');
      expect(remainingLogs[4].url).toBe('https://test9.com');
    });

    it('should apply both retention days and max entries', async () => {
      const testLogger = new Logger();
      
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      
      // Add old logs
      testLogger.logRequest({ url: 'https://old1.com', method: 'GET', headers: {}, timestamp: threeDaysAgo }, []);
      testLogger.logRequest({ url: 'https://old2.com', method: 'GET', headers: {}, timestamp: threeDaysAgo }, []);
      
      // Add recent logs
      for (let i = 0; i < 10; i++) {
        testLogger.logRequest({ 
          url: `https://recent${i}.com`, 
          method: 'GET', 
          headers: {}, 
          timestamp: new Date(oneDayAgo.getTime() + i * 1000) 
        }, []);
      }
      
      expect((await testLogger.getLogs()).length).toBe(12);
      
      // Apply retention policy: keep logs from last 2 days, max 5 entries
      await testLogger.applyRetentionPolicy(2, 5);
      
      const remainingLogs = await testLogger.getLogs();
      expect(remainingLogs.length).toBe(5);
      
      // Should only have recent logs (old ones filtered by date)
      expect(remainingLogs.every(log => log.url.startsWith('https://recent'))).toBe(true);
    });
  });

  // Feature: chrome-request-manager, Property 18: Log retention policy enforcement
  // **Validates: Requirements 5.5**
  describe('Property 18: Log retention policy enforcement', () => {
    it('should automatically delete all logs older than the specified retention period', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 30 }), // retention days
          fc.integer({ min: 10, max: 100 }), // max entries (high enough to not interfere with date filtering)
          fc.array(
            fc.record({
              url: fc.webUrl(),
              method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
              headers: headerArb,
              daysAgo: fc.integer({ min: 0, max: 60 }) // How many days ago this log was created
            }),
            { minLength: 5, maxLength: 30 }
          ),
          async (retentionDays, maxEntries, logSpecs) => {
            // Create a fresh logger for each test iteration
            const testLogger = new Logger();
            
            const now = new Date();
            
            // Create logs with various ages
            for (const spec of logSpecs) {
              const timestamp = new Date(now.getTime() - spec.daysAgo * 24 * 60 * 60 * 1000);
              testLogger.logRequest({
                url: spec.url,
                method: spec.method,
                headers: spec.headers,
                timestamp
              }, []);
            }

            // Get all logs before applying retention policy
            const logsBeforeRetention = await testLogger.getLogs();
            expect(logsBeforeRetention.length).toBe(logSpecs.length);

            // Apply retention policy
            await testLogger.applyRetentionPolicy(retentionDays, maxEntries);

            // Get logs after applying retention policy
            const logsAfterRetention = await testLogger.getLogs();

            // The cutoff date is calculated inside applyRetentionPolicy at the time of execution
            // So we need to calculate it the same way, accounting for execution time
            // We allow a small margin (1 second) for timing differences between test and implementation
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            const cutoffWithMargin = new Date(cutoffDate.getTime() - 1000); // 1 second margin

            // Verify: All remaining logs should be newer than or equal to the cutoff date
            // (using the cutoff calculated at approximately the same time as the policy was applied)
            for (const log of logsAfterRetention) {
              expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(cutoffWithMargin.getTime());
            }

            // Verify: Logs that are clearly older than the retention period should be removed
            // We use a strict threshold: logs older than (retentionDays + 1) days should definitely be gone
            const definitelyOldLogs = logsAfterRetention.filter(log => {
              const ageInDays = (now.getTime() - log.timestamp.getTime()) / (24 * 60 * 60 * 1000);
              return ageInDays > (retentionDays + 1);
            });
            
            expect(definitelyOldLogs.length).toBe(0);

            // Verify: Logs that are clearly within the retention period should be kept
            // (unless limited by maxEntries)
            const definitelyRecentLogs = logSpecs.filter(spec => spec.daysAgo < retentionDays);
            const expectedMinimumCount = Math.min(definitelyRecentLogs.length, maxEntries);
            
            // We should have at least the definitely recent logs (up to maxEntries limit)
            expect(logsAfterRetention.length).toBeGreaterThanOrEqual(expectedMinimumCount);

            // Verify: The total count should not exceed maxEntries
            expect(logsAfterRetention.length).toBeLessThanOrEqual(maxEntries);

            // Verify: If we have fewer logs than maxEntries, all remaining logs should be within retention period
            if (logsAfterRetention.length < maxEntries) {
              for (const log of logsAfterRetention) {
                const ageInDays = (now.getTime() - log.timestamp.getTime()) / (24 * 60 * 60 * 1000);
                // Allow a small margin for execution time (logs at exactly the boundary might be kept or removed)
                expect(ageInDays).toBeLessThanOrEqual(retentionDays + 0.1);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 17: Log filtering correctness
  // **Validates: Requirements 5.4**
  describe('Property 17: Log filtering correctness', () => {
    it('should return only logs matching all specified filter criteria', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(requestInfoArb, { minLength: 5, maxLength: 20 }),
          fc.array(ruleArb, { minLength: 0, maxLength: 3 }),
          async (requests, rules) => {
            // Create a fresh logger for each test iteration
            const testLogger = new Logger();
            
            // Log all requests with random rules applied
            for (const request of requests) {
              // Randomly select which rules to apply to this request
              const appliedRules = rules.filter(() => Math.random() > 0.5);
              testLogger.logRequest(request, appliedRules);
            }

            // Get all logs without filter
            const allLogs = await testLogger.getLogs();

            // Test URL pattern filtering
            if (allLogs.length > 0) {
              const sampleLog = allLogs[0];
              const urlFilter = { urlPattern: sampleLog.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
              const urlFilteredLogs = await testLogger.getLogs(urlFilter);
              
              // All returned logs should match the URL pattern
              for (const log of urlFilteredLogs) {
                expect(log.url).toMatch(new RegExp(urlFilter.urlPattern));
              }
              
              // The sample log should be in the filtered results
              expect(urlFilteredLogs.some(log => log.id === sampleLog.id)).toBe(true);
            }

            // Test method filtering
            if (allLogs.length > 0) {
              const sampleLog = allLogs[0];
              const methodFilter = { method: sampleLog.method };
              const methodFilteredLogs = await testLogger.getLogs(methodFilter);
              
              // All returned logs should have the specified method
              for (const log of methodFilteredLogs) {
                expect(log.method).toBe(methodFilter.method);
              }
              
              // The sample log should be in the filtered results
              expect(methodFilteredLogs.some(log => log.id === sampleLog.id)).toBe(true);
            }

            // Test hasModifications filtering
            const hasModsFilter = { hasModifications: true };
            const hasModsLogs = await testLogger.getLogs(hasModsFilter);
            
            // All returned logs should have modifications
            for (const log of hasModsLogs) {
              expect(log.modifications.length).toBeGreaterThan(0);
            }

            const noModsFilter = { hasModifications: false };
            const noModsLogs = await testLogger.getLogs(noModsFilter);
            
            // All returned logs should have no modifications
            for (const log of noModsLogs) {
              expect(log.modifications.length).toBe(0);
            }

            // Test date range filtering
            if (allLogs.length >= 2) {
              const sortedLogs = [...allLogs].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
              const start = sortedLogs[0].timestamp;
              const end = sortedLogs[sortedLogs.length - 1].timestamp;
              
              const dateRangeFilter = { dateRange: { start, end } };
              const dateFilteredLogs = await testLogger.getLogs(dateRangeFilter);
              
              // All returned logs should be within the date range
              for (const log of dateFilteredLogs) {
                expect(log.timestamp.getTime()).toBeGreaterThanOrEqual(start.getTime());
                expect(log.timestamp.getTime()).toBeLessThanOrEqual(end.getTime());
              }
            }

            // Test combined filters
            if (allLogs.length > 0) {
              const sampleLog = allLogs[0];
              const combinedFilter = {
                method: sampleLog.method,
                hasModifications: sampleLog.modifications.length > 0
              };
              const combinedFilteredLogs = await testLogger.getLogs(combinedFilter);
              
              // All returned logs should match ALL filter criteria
              for (const log of combinedFilteredLogs) {
                expect(log.method).toBe(combinedFilter.method);
                if (combinedFilter.hasModifications) {
                  expect(log.modifications.length).toBeGreaterThan(0);
                } else {
                  expect(log.modifications.length).toBe(0);
                }
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
