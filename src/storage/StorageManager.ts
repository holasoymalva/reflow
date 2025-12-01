// Storage Manager implementation
import { Rule, ExtensionConfig, LogEntry, ExportData, ImportResult, ErrorCode, ExtensionError } from '@/types';

const STORAGE_KEYS = {
  RULES: 'rules',
  CONFIG: 'config',
  LOGS: 'logs',
  METADATA: 'metadata'
} as const;

const DEFAULT_CONFIG: ExtensionConfig = {
  globalPaused: false,
  logRetentionDays: 7,
  maxLogEntries: 1000,
  enableHTTPS: false,
  theme: 'auto'
};

// Storage schema for documentation purposes
// interface StorageSchema {
//   rules: { [ruleId: string]: SerializedRule };
//   config: ExtensionConfig;
//   logs: SerializedLogEntry[];
//   metadata: {
//     version: string;
//     lastSync: string;
//   };
// }

// Serialized versions for storage (dates as ISO strings)
interface SerializedRule extends Omit<Rule, 'createdAt' | 'modifiedAt' | 'urlPattern'> {
  urlPattern: string;
  createdAt: string;
  modifiedAt: string;
}

interface SerializedLogEntry extends Omit<LogEntry, 'timestamp'> {
  timestamp: string;
}

export class StorageManager {
  private storage: chrome.storage.LocalStorageArea;

  constructor() {
    // Use chrome.storage.local if available, otherwise use a mock for testing
    this.storage = (typeof chrome !== 'undefined' && chrome.storage) 
      ? chrome.storage.local 
      : this.createMockStorage();
  }

  private createMockStorage(): chrome.storage.LocalStorageArea {
    const mockData: Record<string, any> = {};
    return {
      get: (keys: string | string[] | null) => {
        return Promise.resolve(
          typeof keys === 'string' 
            ? { [keys]: mockData[keys] }
            : keys === null
            ? mockData
            : keys.reduce((acc, key) => ({ ...acc, [key]: mockData[key] }), {})
        );
      },
      set: (items: Record<string, any>) => {
        Object.assign(mockData, items);
        return Promise.resolve();
      },
      remove: (keys: string | string[]) => {
        const keysArray = typeof keys === 'string' ? [keys] : keys;
        keysArray.forEach(key => delete mockData[key]);
        return Promise.resolve();
      },
      clear: () => {
        Object.keys(mockData).forEach(key => delete mockData[key]);
        return Promise.resolve();
      }
    } as chrome.storage.LocalStorageArea;
  }

  async saveRules(rules: Rule[]): Promise<void> {
    try {
      const rulesMap: { [ruleId: string]: SerializedRule } = {};
      
      for (const rule of rules) {
        rulesMap[rule.id] = {
          ...rule,
          urlPattern: rule.urlPattern instanceof RegExp 
            ? rule.urlPattern.source 
            : rule.urlPattern,
          createdAt: rule.createdAt.toISOString(),
          modifiedAt: rule.modifiedAt.toISOString()
        };
      }

      await this.storage.set({ [STORAGE_KEYS.RULES]: rulesMap });
      await this.updateMetadata();
    } catch (error) {
      if (this.isQuotaExceededError(error)) {
        throw new ExtensionError(
          'Storage quota exceeded',
          ErrorCode.STORAGE_ERROR,
          true,
          'Storage limit reached. Please clear old logs or rules to free up space.'
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new ExtensionError(
        message,
        ErrorCode.STORAGE_ERROR,
        true,
        'Failed to save rules. Please try again.'
      );
    }
  }

  async loadRules(): Promise<Rule[]> {
    try {
      const result = await this.storage.get(STORAGE_KEYS.RULES);
      const rulesMap = result[STORAGE_KEYS.RULES] as { [ruleId: string]: SerializedRule } | undefined;

      if (!rulesMap) {
        return [];
      }

      return Object.values(rulesMap).map(serializedRule => ({
        ...serializedRule,
        urlPattern: serializedRule.urlPattern,
        createdAt: new Date(serializedRule.createdAt),
        modifiedAt: new Date(serializedRule.modifiedAt)
      }));
    } catch (error) {
      console.error('Failed to load rules:', error);
      // Return empty array to continue operating with in-memory rules
      return [];
    }
  }

  async saveConfig(config: ExtensionConfig): Promise<void> {
    try {
      await this.storage.set({ [STORAGE_KEYS.CONFIG]: config });
      await this.updateMetadata();
    } catch (error) {
      if (this.isQuotaExceededError(error)) {
        throw new ExtensionError(
          'Storage quota exceeded',
          ErrorCode.STORAGE_ERROR,
          true,
          'Storage limit reached. Please clear old data to free up space.'
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new ExtensionError(
        message,
        ErrorCode.STORAGE_ERROR,
        true,
        'Failed to save configuration. Please try again.'
      );
    }
  }

  async loadConfig(): Promise<ExtensionConfig> {
    try {
      const result = await this.storage.get(STORAGE_KEYS.CONFIG);
      const config = result[STORAGE_KEYS.CONFIG] as ExtensionConfig | undefined;

      return config || DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to load config:', error);
      return DEFAULT_CONFIG;
    }
  }

  async saveLogs(logs: LogEntry[]): Promise<void> {
    try {
      const config = await this.loadConfig();
      
      // Apply size limit
      const limitedLogs = logs.slice(-config.maxLogEntries);

      const serializedLogs: SerializedLogEntry[] = limitedLogs.map(log => ({
        ...log,
        timestamp: log.timestamp.toISOString()
      }));

      await this.storage.set({ [STORAGE_KEYS.LOGS]: serializedLogs });
      await this.updateMetadata();
    } catch (error) {
      if (this.isQuotaExceededError(error)) {
        // Try to save with fewer logs
        const reducedLogs = logs.slice(-Math.floor(logs.length / 2));
        const serializedLogs: SerializedLogEntry[] = reducedLogs.map(log => ({
          ...log,
          timestamp: log.timestamp.toISOString()
        }));
        await this.storage.set({ [STORAGE_KEYS.LOGS]: serializedLogs });
        throw new ExtensionError(
          'Storage quota exceeded',
          ErrorCode.STORAGE_ERROR,
          true,
          'Storage limit reached. Logs have been automatically reduced. Consider clearing old logs.'
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new ExtensionError(
        message,
        ErrorCode.STORAGE_ERROR,
        true,
        'Failed to save logs. Please try again.'
      );
    }
  }

  async loadLogs(limit?: number): Promise<LogEntry[]> {
    try {
      const result = await this.storage.get(STORAGE_KEYS.LOGS);
      const serializedLogs = result[STORAGE_KEYS.LOGS] as SerializedLogEntry[] | undefined;

      if (!serializedLogs) {
        return [];
      }

      const logs = serializedLogs.map(serializedLog => ({
        ...serializedLog,
        timestamp: new Date(serializedLog.timestamp)
      }));

      return limit ? logs.slice(-limit) : logs;
    } catch (error) {
      console.error('Failed to load logs:', error);
      return [];
    }
  }

  async exportData(): Promise<ExportData> {
    const rules = await this.loadRules();
    const config = await this.loadConfig();

    return {
      version: '1.0.0',
      exportDate: new Date(),
      rules,
      config
    };
  }

  async importData(data: ExportData): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      importedRules: 0,
      skippedRules: 0,
      errors: []
    };

    try {
      // Validate data structure
      if (!data.rules || !Array.isArray(data.rules)) {
        result.success = false;
        result.errors.push('Invalid data format: rules must be an array');
        return result;
      }

      const existingRules = await this.loadRules();
      const existingNames = new Set(existingRules.map(r => r.name));
      const rulesToImport: Rule[] = [];

      for (const rule of data.rules) {
        // Validate rule structure
        if (!this.isValidRule(rule)) {
          result.skippedRules++;
          result.errors.push(`Invalid rule structure: ${rule.name || 'unnamed'}`);
          continue;
        }

        // Check for duplicate names
        if (existingNames.has(rule.name)) {
          result.skippedRules++;
          result.errors.push(`Duplicate rule name: ${rule.name}`);
          continue;
        }

        rulesToImport.push(rule);
        existingNames.add(rule.name);
        result.importedRules++;
      }

      // Save imported rules
      if (rulesToImport.length > 0) {
        const allRules = [...existingRules, ...rulesToImport];
        await this.saveRules(allRules);
      }

      result.success = result.importedRules > 0 || result.skippedRules === 0;
    } catch (error) {
      result.success = false;
      result.errors.push(`Import failed: ${error}`);
    }

    return result;
  }

  async clearAll(): Promise<void> {
    try {
      await this.storage.clear();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ExtensionError(
        message,
        ErrorCode.STORAGE_ERROR,
        true,
        'Failed to clear extension data. Please try again.'
      );
    }
  }

  private async updateMetadata(): Promise<void> {
    const metadata = {
      version: '1.0.0',
      lastSync: new Date().toISOString()
    };
    await this.storage.set({ [STORAGE_KEYS.METADATA]: metadata });
  }

  private isQuotaExceededError(error: any): boolean {
    return error && (
      error.message?.includes('QUOTA_BYTES') ||
      error.message?.includes('quota') ||
      error.name === 'QuotaExceededError'
    );
  }

  private isValidRule(rule: any): boolean {
    return (
      rule &&
      typeof rule.id === 'string' &&
      typeof rule.name === 'string' &&
      typeof rule.enabled === 'boolean' &&
      typeof rule.priority === 'number' &&
      (typeof rule.urlPattern === 'string' || rule.urlPattern instanceof RegExp) &&
      rule.action &&
      typeof rule.action.type === 'string' &&
      rule.createdAt &&
      rule.modifiedAt
    );
  }
}
