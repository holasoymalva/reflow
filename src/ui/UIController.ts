import { 
  Message, 
  Response, 
  Rule, 
  LogEntry, 
  LogFilter, 
  ExportData, 
  ImportResult,
  ExtensionConfig,
  ErrorCode,
  ExtensionError
} from '@/types';
import { errorHandler } from './utils/errorHandler';

/**
 * UIController provides a type-safe wrapper around chrome.runtime.sendMessage
 * for communication between UI components and the service worker.
 */
export class UIController {
  /**
   * Sends a message to the service worker and returns the response
   * @throws ExtensionError if the message fails or returns an error response
   */
  private async sendMessage<T = any>(message: Message): Promise<T> {
    try {
      const response = await chrome.runtime.sendMessage(message) as Response;
      
      if (!response.success) {
        const error = errorHandler.createExtensionError(
          new Error(response.error || 'Unknown error occurred'),
          ErrorCode.NETWORK_ERROR,
          response.error || 'Failed to communicate with extension background service.'
        );
        errorHandler.handleError(error);
        throw error;
      }

      return response.data as T;
    } catch (error) {
      // Handle chrome.runtime errors
      if (chrome.runtime.lastError) {
        const extensionError = errorHandler.createExtensionError(
          new Error(chrome.runtime.lastError.message),
          ErrorCode.NETWORK_ERROR,
          'Failed to communicate with extension. Please try again.'
        );
        errorHandler.handleError(extensionError);
        throw extensionError;
      }
      
      // If it's already an ExtensionError, just rethrow
      if (error instanceof ExtensionError) {
        throw error;
      }
      
      // Wrap other errors
      const extensionError = errorHandler.createExtensionError(
        error,
        ErrorCode.UNKNOWN_ERROR
      );
      errorHandler.handleError(extensionError);
      throw extensionError;
    }
  }

  /**
   * Fetches all rules from the service worker
   */
  async getRules(): Promise<Rule[]> {
    return this.sendMessage<Rule[]>({ type: 'getRules' });
  }

  /**
   * Creates a new rule
   */
  async createRule(rule: Omit<Rule, 'id' | 'createdAt' | 'modifiedAt'>): Promise<Rule> {
    return this.sendMessage<Rule>({ 
      type: 'createRule', 
      payload: rule 
    });
  }

  /**
   * Updates an existing rule
   */
  async updateRule(id: string, updates: Partial<Rule>): Promise<Rule> {
    return this.sendMessage<Rule>({ 
      type: 'updateRule', 
      payload: { id, updates } 
    });
  }

  /**
   * Deletes a rule by ID
   */
  async deleteRule(id: string): Promise<void> {
    return this.sendMessage<void>({ 
      type: 'deleteRule', 
      payload: { id } 
    });
  }

  /**
   * Toggles a rule's enabled state
   */
  async toggleRule(id: string, enabled: boolean): Promise<void> {
    return this.sendMessage<void>({ 
      type: 'toggleRule', 
      payload: { id, enabled } 
    });
  }

  /**
   * Toggles the global pause state
   */
  async toggleGlobalPause(paused: boolean): Promise<void> {
    return this.sendMessage<void>({ 
      type: 'toggleGlobalPause', 
      payload: { paused } 
    });
  }

  /**
   * Fetches logs with optional filtering
   */
  async getLogs(filter?: LogFilter): Promise<LogEntry[]> {
    return this.sendMessage<LogEntry[]>({ 
      type: 'getLogs', 
      payload: { filter } 
    });
  }

  /**
   * Clears all logs
   */
  async clearLogs(): Promise<void> {
    return this.sendMessage<void>({ type: 'clearLogs' });
  }

  /**
   * Exports all extension data (rules and config)
   */
  async exportData(): Promise<ExportData> {
    return this.sendMessage<ExportData>({ type: 'exportData' });
  }

  /**
   * Imports extension data from an export file
   */
  async importData(data: ExportData): Promise<ImportResult> {
    return this.sendMessage<ImportResult>({ 
      type: 'importData', 
      payload: { data } 
    });
  }

  /**
   * Gets the current extension configuration
   */
  async getConfig(): Promise<ExtensionConfig> {
    return this.sendMessage<ExtensionConfig>({ type: 'getConfig' });
  }

  /**
   * Updates the extension configuration
   */
  async updateConfig(config: Partial<ExtensionConfig>): Promise<void> {
    return this.sendMessage<void>({ 
      type: 'updateConfig', 
      payload: { config } 
    });
  }

  /**
   * Clears all extension data (rules, logs, config)
   */
  async clearAllData(): Promise<void> {
    return this.sendMessage<void>({ type: 'clearAllData' });
  }
}

// Export a singleton instance for convenience
export const uiController = new UIController();
