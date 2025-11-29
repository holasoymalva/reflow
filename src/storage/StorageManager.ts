// Storage Manager implementation
// This will be implemented in subsequent tasks

import { Rule, ExtensionConfig, LogEntry, ExportData, ImportResult } from '@/types';

export class StorageManager {
  async saveRules(_rules: Rule[]): Promise<void> {
    // To be implemented
    throw new Error('Not implemented');
  }

  async loadRules(): Promise<Rule[]> {
    // To be implemented
    throw new Error('Not implemented');
  }

  async saveConfig(_config: ExtensionConfig): Promise<void> {
    // To be implemented
    throw new Error('Not implemented');
  }

  async loadConfig(): Promise<ExtensionConfig> {
    // To be implemented
    throw new Error('Not implemented');
  }

  async saveLogs(_logs: LogEntry[]): Promise<void> {
    // To be implemented
    throw new Error('Not implemented');
  }

  async loadLogs(_limit?: number): Promise<LogEntry[]> {
    // To be implemented
    throw new Error('Not implemented');
  }

  async exportData(): Promise<ExportData> {
    // To be implemented
    throw new Error('Not implemented');
  }

  async importData(_data: ExportData): Promise<ImportResult> {
    // To be implemented
    throw new Error('Not implemented');
  }

  async clearAll(): Promise<void> {
    // To be implemented
    throw new Error('Not implemented');
  }
}
