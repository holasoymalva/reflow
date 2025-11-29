import * as fc from 'fast-check';
import { StorageManager } from './StorageManager';

describe('StorageManager', () => {
  let storageManager: StorageManager;

  beforeEach(() => {
    storageManager = new StorageManager();
  });

  afterEach(async () => {
    await storageManager.clearAll();
  });

  // Arbitraries for property-based testing
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

  // Feature: chrome-request-manager, Property 1: Rule persistence round trip
  // **Validates: Requirements 9.1, 9.2**
  describe('Property 1: Rule persistence round trip', () => {
    it('should preserve rule data through save and load cycle', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(ruleArb, { minLength: 0, maxLength: 20 }), async (rules) => {
          // Save rules
          await storageManager.saveRules(rules);

          // Load rules
          const loadedRules = await storageManager.loadRules();

          // Verify count matches
          expect(loadedRules).toHaveLength(rules.length);

          // Verify each rule is equivalent
          for (let i = 0; i < rules.length; i++) {
            const original = rules[i];
            const loaded = loadedRules.find(r => r.id === original.id);

            expect(loaded).toBeDefined();
            expect(loaded!.id).toBe(original.id);
            expect(loaded!.name).toBe(original.name);
            expect(loaded!.enabled).toBe(original.enabled);
            expect(loaded!.priority).toBe(original.priority);
            expect(loaded!.urlPattern).toBe(original.urlPattern);
            expect(loaded!.action).toEqual(original.action);
            expect(loaded!.createdAt.getTime()).toBe(original.createdAt.getTime());
            expect(loaded!.modifiedAt.getTime()).toBe(original.modifiedAt.getTime());
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 28: Storage synchronization timing
  // **Validates: Requirements 9.4**
  describe('Property 28: Storage synchronization timing', () => {
    it('should persist rule changes to storage within 1 second', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(ruleArb, { minLength: 1, maxLength: 10 }), async (rules) => {
          const startTime = Date.now();
          
          // Save rules
          await storageManager.saveRules(rules);
          
          const endTime = Date.now();
          const duration = endTime - startTime;

          // Verify persistence completed within 1 second (1000ms)
          expect(duration).toBeLessThan(1000);

          // Verify data was actually persisted
          const loadedRules = await storageManager.loadRules();
          expect(loadedRules).toHaveLength(rules.length);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 29: Storage failure resilience
  // **Validates: Requirements 9.3**
  describe('Property 29: Storage failure resilience', () => {
    it('should log errors and continue operating when storage operations fail', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(ruleArb, { minLength: 1, maxLength: 5 }), async (rules) => {
          // Create a storage manager with a failing storage backend
          const failingStorage = {
            get: () => Promise.reject(new Error('Storage read failed')),
            set: () => Promise.reject(new Error('Storage write failed')),
            remove: () => Promise.reject(new Error('Storage remove failed')),
            clear: () => Promise.reject(new Error('Storage clear failed'))
          } as unknown as chrome.storage.LocalStorageArea;

          const failingStorageManager = new StorageManager();
          (failingStorageManager as any).storage = failingStorage;

          // Attempt to save rules - should throw but not crash
          await expect(failingStorageManager.saveRules(rules)).rejects.toThrow();

          // Attempt to load rules - should return empty array and not crash
          const loadedRules = await failingStorageManager.loadRules();
          expect(loadedRules).toEqual([]);

          // Attempt to load config - should return default config and not crash
          const config = await failingStorageManager.loadConfig();
          expect(config).toBeDefined();
          expect(config.globalPaused).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 19: Export completeness
  // **Validates: Requirements 6.1, 6.4**
  describe('Property 19: Export completeness', () => {
    it('should export all rules with complete configurations and metadata', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(ruleArb, { minLength: 0, maxLength: 10 }), async (rules) => {
          // Save rules first
          await storageManager.saveRules(rules);

          // Export data
          const exportData = await storageManager.exportData();

          // Verify export contains all rules
          expect(exportData.rules).toHaveLength(rules.length);

          // Verify each rule has complete configuration and metadata
          for (const rule of rules) {
            const exportedRule = exportData.rules.find(r => r.id === rule.id);
            expect(exportedRule).toBeDefined();
            expect(exportedRule!.name).toBe(rule.name);
            expect(exportedRule!.enabled).toBe(rule.enabled);
            expect(exportedRule!.priority).toBe(rule.priority);
            expect(exportedRule!.urlPattern).toBe(rule.urlPattern);
            expect(exportedRule!.action).toEqual(rule.action);
            // Verify metadata is present
            expect(exportedRule!.createdAt).toBeDefined();
            expect(exportedRule!.modifiedAt).toBeDefined();
          }

          // Verify export metadata
          expect(exportData.version).toBeDefined();
          expect(exportData.exportDate).toBeInstanceOf(Date);
          expect(exportData.config).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 20: Import validation and addition
  // **Validates: Requirements 6.2, 6.5**
  describe('Property 20: Import validation and addition', () => {
    it('should validate file format and add only valid rules', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(ruleArb, { minLength: 1, maxLength: 10 }), async (rules) => {
          // Create valid export data
          const validExportData = {
            version: '1.0.0',
            exportDate: new Date(),
            rules,
            config: {
              globalPaused: false,
              logRetentionDays: 7,
              maxLogEntries: 1000,
              enableHTTPS: false,
              theme: 'auto' as const
            }
          };

          // Import valid data
          const result = await storageManager.importData(validExportData);

          // Verify all valid rules were imported
          expect(result.success).toBe(true);
          expect(result.importedRules).toBe(rules.length);
          expect(result.skippedRules).toBe(0);
          expect(result.errors).toHaveLength(0);

          // Verify rules were actually added
          const loadedRules = await storageManager.loadRules();
          expect(loadedRules).toHaveLength(rules.length);

          // Test invalid data format
          await storageManager.clearAll();
          const invalidData = { version: '1.0.0', exportDate: new Date(), rules: 'not an array', config: {} } as any;
          const invalidResult = await storageManager.importData(invalidData);

          expect(invalidResult.success).toBe(false);
          expect(invalidResult.errors.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 22: Export-import round trip
  // **Validates: Requirements 6.1, 6.2**
  describe('Property 22: Export-import round trip', () => {
    it('should preserve rules through export and import cycle', async () => {
      await fc.assert(
        fc.asyncProperty(fc.array(ruleArb, { minLength: 1, maxLength: 10 }), async (rules) => {
          // Save original rules
          await storageManager.saveRules(rules);

          // Export data
          const exportData = await storageManager.exportData();

          // Clear storage
          await storageManager.clearAll();

          // Import data
          const importResult = await storageManager.importData(exportData);

          // Verify import was successful
          expect(importResult.success).toBe(true);
          expect(importResult.importedRules).toBe(rules.length);

          // Load imported rules
          const importedRules = await storageManager.loadRules();

          // Verify count matches
          expect(importedRules).toHaveLength(rules.length);

          // Verify each rule is equivalent
          for (const original of rules) {
            const imported = importedRules.find(r => r.id === original.id);
            expect(imported).toBeDefined();
            expect(imported!.name).toBe(original.name);
            expect(imported!.enabled).toBe(original.enabled);
            expect(imported!.priority).toBe(original.priority);
            expect(imported!.urlPattern).toBe(original.urlPattern);
            expect(imported!.action).toEqual(original.action);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  // Feature: chrome-request-manager, Property 21: Import duplicate detection
  // **Validates: Requirements 6.3**
  describe('Property 21: Import duplicate detection', () => {
    it('should detect and skip rules with duplicate names', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(ruleArb, { minLength: 2, maxLength: 10 }),
          async (rules) => {
            // Save initial rules
            await storageManager.saveRules(rules);

            // Create import data with a rule that has a duplicate name
            const duplicateRule = {
              ...rules[0],
              id: fc.sample(fc.uuid(), 1)[0], // Different ID but same name
            };

            const importData = {
              version: '1.0.0',
              exportDate: new Date(),
              rules: [duplicateRule],
              config: {
                globalPaused: false,
                logRetentionDays: 7,
                maxLogEntries: 1000,
                enableHTTPS: false,
                theme: 'auto' as const
              }
            };

            // Attempt to import
            const result = await storageManager.importData(importData);

            // Verify duplicate was detected and skipped
            expect(result.skippedRules).toBe(1);
            expect(result.importedRules).toBe(0);
            expect(result.errors.some(e => e.includes('Duplicate rule name'))).toBe(true);

            // Verify original rules are unchanged
            const loadedRules = await storageManager.loadRules();
            expect(loadedRules).toHaveLength(rules.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
