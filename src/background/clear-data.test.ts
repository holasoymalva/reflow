import * as fc from 'fast-check';
import { StorageManager } from '../storage/StorageManager';
import { Logger } from '../logger/Logger';
import { ExtensionConfig } from '../types';

/**
 * Feature: chrome-request-manager, Property 30: Extension data clear completeness
 * 
 * For any extension state, when the user clears extension data, all rules should be removed from storage 
 * and the extension should reset to default state
 * Validates: Requirements 9.5
 */

// Mock chrome.storage API
const mockStorage: Record<string, any> = {};

global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys: string | string[] | null) => {
        return Promise.resolve(
          typeof keys === 'string' 
            ? { [keys]: mockStorage[keys] }
            : keys === null
            ? { ...mockStorage }
            : keys.reduce((acc, key) => ({ ...acc, [key]: mockStorage[key] }), {})
        );
      }),
      set: jest.fn((items: Record<string, any>) => {
        Object.assign(mockStorage, items);
        return Promise.resolve();
      }),
      remove: jest.fn((keys: string | string[]) => {
        const keysArray = typeof keys === 'string' ? [keys] : keys;
        keysArray.forEach(key => delete mockStorage[key]);
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
        return Promise.resolve();
      })
    }
  }
} as any;

// Arbitraries for generating test data
const ruleArb = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  enabled: fc.boolean(),
  priority: fc.integer({ min: 1, max: 100 }),
  urlPattern: fc.constant('.*'),
  action: fc.record({
    type: fc.constant('modifyHeaders' as const),
    requestHeaders: fc.constant([]),
  }),
  createdAt: fc.date(),
  modifiedAt: fc.date(),
});

const logEntryArb = fc.record({
  id: fc.uuid(),
  timestamp: fc.date(),
  url: fc.webUrl(),
  method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'),
  statusCode: fc.integer({ min: 100, max: 599 }),
  requestHeaders: fc.dictionary(fc.string(), fc.string()),
  responseHeaders: fc.dictionary(fc.string(), fc.string()),
  appliedRules: fc.array(fc.uuid(), { maxLength: 3 }),
  modifications: fc.array(fc.string(), { maxLength: 3 }),
});

const configArb = fc.record({
  globalPaused: fc.boolean(),
  logRetentionDays: fc.integer({ min: 1, max: 365 }),
  maxLogEntries: fc.integer({ min: 100, max: 10000 }),
  enableHTTPS: fc.boolean(),
  theme: fc.constantFrom('light' as const, 'dark' as const, 'auto' as const),
});

const defaultConfig: ExtensionConfig = {
  globalPaused: false,
  logRetentionDays: 7,
  maxLogEntries: 1000,
  enableHTTPS: false,
  theme: 'auto'
};

describe('Property 30: Extension data clear completeness', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockStorage).forEach(key => delete mockStorage[key]);
    jest.clearAllMocks();
  });

  it('should remove all rules from storage when clearing data', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(ruleArb, { minLength: 1, maxLength: 10 }), async (rules) => {
        const storageManager = new StorageManager();
        
        // Save rules to storage
        await storageManager.saveRules(rules);
        
        // Verify rules are saved
        const savedRules = await storageManager.loadRules();
        expect(savedRules.length).toBe(rules.length);
        
        // Clear all data
        await storageManager.saveRules([]);
        
        // Verify all rules are removed
        const clearedRules = await storageManager.loadRules();
        expect(clearedRules).toEqual([]);
        expect(clearedRules.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should remove all logs from storage when clearing data', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(logEntryArb, { minLength: 1, maxLength: 20 }), async (logs) => {
        const storageManager = new StorageManager();
        const logger = new Logger();
        
        // Add logs
        logs.forEach(log => logger.logRequest({
          url: log.url,
          method: log.method,
          headers: log.requestHeaders,
          timestamp: log.timestamp
        }, []));
        
        // Save logs to storage
        await storageManager.saveLogs(logger.getAllLogs());
        
        // Verify logs are saved
        const savedLogs = await storageManager.loadLogs();
        expect(savedLogs.length).toBeGreaterThan(0);
        
        // Clear all logs
        await logger.clearLogs();
        await storageManager.saveLogs([]);
        
        // Verify all logs are removed
        const clearedLogs = await storageManager.loadLogs();
        expect(clearedLogs).toEqual([]);
        expect(clearedLogs.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should reset config to default state when clearing data', async () => {
    await fc.assert(
      fc.asyncProperty(configArb, async (customConfig) => {
        const storageManager = new StorageManager();
        
        // Save custom config
        await storageManager.saveConfig(customConfig);
        
        // Verify custom config is saved
        const savedConfig = await storageManager.loadConfig();
        expect(savedConfig).toEqual(customConfig);
        
        // Reset to default config
        await storageManager.saveConfig(defaultConfig);
        
        // Verify config is reset to defaults
        const resetConfig = await storageManager.loadConfig();
        expect(resetConfig).toEqual(defaultConfig);
        expect(resetConfig.globalPaused).toBe(false);
        expect(resetConfig.logRetentionDays).toBe(7);
        expect(resetConfig.maxLogEntries).toBe(1000);
        expect(resetConfig.enableHTTPS).toBe(false);
        expect(resetConfig.theme).toBe('auto');
      }),
      { numRuns: 100 }
    );
  });

  it('should clear all data types simultaneously', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(ruleArb, { minLength: 1, maxLength: 5 }),
        fc.array(logEntryArb, { minLength: 1, maxLength: 10 }),
        configArb,
        async (rules, logs, customConfig) => {
          const storageManager = new StorageManager();
          const logger = new Logger();
          
          // Save all data types
          await storageManager.saveRules(rules);
          logs.forEach(log => logger.logRequest({
            url: log.url,
            method: log.method,
            headers: log.requestHeaders,
            timestamp: log.timestamp
          }, []));
          await storageManager.saveLogs(logger.getAllLogs());
          await storageManager.saveConfig(customConfig);
          
          // Verify all data is saved
          expect((await storageManager.loadRules()).length).toBe(rules.length);
          expect((await storageManager.loadLogs()).length).toBeGreaterThan(0);
          expect(await storageManager.loadConfig()).toEqual(customConfig);
          
          // Clear all data
          await storageManager.saveRules([]);
          await logger.clearLogs();
          await storageManager.saveLogs([]);
          await storageManager.saveConfig(defaultConfig);
          
          // Verify all data is cleared/reset
          const clearedRules = await storageManager.loadRules();
          const clearedLogs = await storageManager.loadLogs();
          const resetConfig = await storageManager.loadConfig();
          
          expect(clearedRules).toEqual([]);
          expect(clearedLogs).toEqual([]);
          expect(resetConfig).toEqual(defaultConfig);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain empty state after clearing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(ruleArb, { minLength: 1, maxLength: 5 }),
        async (rules) => {
          const storageManager = new StorageManager();
          
          // Save rules
          await storageManager.saveRules(rules);
          
          // Clear data
          await storageManager.saveRules([]);
          
          // Verify empty state is maintained
          const firstCheck = await storageManager.loadRules();
          expect(firstCheck).toEqual([]);
          
          // Load again to ensure state persists
          const secondCheck = await storageManager.loadRules();
          expect(secondCheck).toEqual([]);
          expect(secondCheck.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow new data to be added after clearing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(ruleArb, { minLength: 1, maxLength: 5 }),
        fc.array(ruleArb, { minLength: 1, maxLength: 5 }),
        async (oldRules, newRules) => {
          const storageManager = new StorageManager();
          
          // Save old rules
          await storageManager.saveRules(oldRules);
          
          // Clear data
          await storageManager.saveRules([]);
          
          // Verify cleared
          expect((await storageManager.loadRules()).length).toBe(0);
          
          // Add new rules
          await storageManager.saveRules(newRules);
          
          // Verify new rules are saved correctly
          const savedNewRules = await storageManager.loadRules();
          expect(savedNewRules.length).toBe(newRules.length);
          expect(savedNewRules).toEqual(newRules);
        }
      ),
      { numRuns: 100 }
    );
  });
});
