import { 
  Message, 
  Response, 
  Rule, 
  LogEntry, 
  LogFilter, 
  ExportData, 
  ImportResult 
} from '@/types';

/**
 * UIController provides a type-safe wrapper around chrome.runtime.sendMessage
 * for communication between UI components and the service worker.
 */
export class UIController {
  /**
   * Sends a message to the service worker and returns the response
   * @throws Error if the message fails or returns an error response
   */
  private async sendMessage<T = any>(message: Message): Promise<T> {
    try {
      const response = await chrome.runtime.sendMessage(message) as Response;
      
      if (!response.success) {
        throw new Error(response.error || 'Unknown error occurred');
      }

      return response.data as T;
    } catch (error) {
      // Handle chrome.runtime errors
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }
      throw error;
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
}

// Export a singleton instance for convenience
export const uiController = new UIController();
