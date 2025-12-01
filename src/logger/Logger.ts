// Logger implementation for Chrome Request Manager
import { LogEntry, LogFilter, Rule } from '@/types';

export interface RequestInfo {
  url: string;
  method: string;
  headers: Record<string, string>;
  timestamp: Date;
}

export interface ResponseInfo {
  statusCode: number;
  headers: Record<string, string>;
}

const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'www-authenticate',
  'x-api-key',
  'api-key'
];

export class Logger {
  private logs: LogEntry[] = [];
  private logIdCounter = 0;

  /**
   * Log a request with applied rules
   */
  logRequest(request: RequestInfo, appliedRules: Rule[]): void {
    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: request.timestamp,
      url: request.url,
      method: request.method,
      requestHeaders: this.filterSensitiveData(request.url, request.headers),
      appliedRules: appliedRules.map(r => r.id),
      modifications: this.extractModifications(appliedRules)
    };

    this.logs.push(logEntry);
  }

  /**
   * Log a response with applied rules
   */
  logResponse(response: ResponseInfo, request: RequestInfo, appliedRules: Rule[]): void {
    // Find existing log entry for this request or create new one
    const existingLog = this.logs.find(
      log => log.url === request.url && 
             log.method === request.method && 
             !log.statusCode &&
             Math.abs(log.timestamp.getTime() - request.timestamp.getTime()) < 5000
    );

    if (existingLog) {
      // Update existing log entry with response data
      existingLog.statusCode = response.statusCode;
      existingLog.responseHeaders = this.filterSensitiveData(request.url, response.headers);
      
      // Merge applied rules if any new ones
      const newRuleIds = appliedRules.map(r => r.id).filter(id => !existingLog.appliedRules.includes(id));
      existingLog.appliedRules.push(...newRuleIds);
      
      // Merge modifications
      const newModifications = this.extractModifications(appliedRules).filter(
        mod => !existingLog.modifications.includes(mod)
      );
      existingLog.modifications.push(...newModifications);
    } else {
      // Create new log entry for response
      const logEntry: LogEntry = {
        id: this.generateLogId(),
        timestamp: request.timestamp,
        url: request.url,
        method: request.method,
        statusCode: response.statusCode,
        requestHeaders: this.filterSensitiveData(request.url, request.headers),
        responseHeaders: this.filterSensitiveData(request.url, response.headers),
        appliedRules: appliedRules.map(r => r.id),
        modifications: this.extractModifications(appliedRules)
      };

      this.logs.push(logEntry);
    }
  }

  /**
   * Get logs with optional filtering
   */
  async getLogs(filter?: LogFilter): Promise<LogEntry[]> {
    let filteredLogs = [...this.logs];

    if (filter) {
      // Filter by URL pattern
      if (filter.urlPattern) {
        const pattern = new RegExp(filter.urlPattern);
        filteredLogs = filteredLogs.filter(log => pattern.test(log.url));
      }

      // Filter by method
      if (filter.method) {
        filteredLogs = filteredLogs.filter(log => log.method === filter.method);
      }

      // Filter by status code
      if (filter.statusCode !== undefined) {
        filteredLogs = filteredLogs.filter(log => log.statusCode === filter.statusCode);
      }

      // Filter by modifications
      if (filter.hasModifications !== undefined) {
        filteredLogs = filteredLogs.filter(log => 
          filter.hasModifications ? log.modifications.length > 0 : log.modifications.length === 0
        );
      }

      // Filter by date range
      if (filter.dateRange) {
        filteredLogs = filteredLogs.filter(log => 
          log.timestamp >= filter.dateRange!.start && log.timestamp <= filter.dateRange!.end
        );
      }
    }

    // Sort chronologically (oldest first)
    return filteredLogs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Clear logs older than specified date
   */
  async clearLogs(olderThan?: Date): Promise<void> {
    if (olderThan) {
      this.logs = this.logs.filter(log => log.timestamp >= olderThan);
    } else {
      this.logs = [];
    }
  }

  /**
   * Get all logs (for persistence)
   */
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Set logs (for loading from storage)
   */
  setLogs(logs: LogEntry[]): void {
    this.logs = [...logs];
  }

  /**
   * Apply log retention policy
   */
  async applyRetentionPolicy(retentionDays: number, maxEntries: number): Promise<void> {
    // Remove logs older than retention period
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    this.logs = this.logs.filter(log => log.timestamp >= cutoffDate);

    // Limit to max entries (keep most recent)
    if (this.logs.length > maxEntries) {
      this.logs = this.logs.slice(-maxEntries);
    }
  }

  /**
   * Filter sensitive data from headers for HTTPS requests
   */
  private filterSensitiveData(url: string, headers: Record<string, string>): Record<string, string> {
    const isHTTPS = url.startsWith('https://');
    
    if (!isHTTPS) {
      return headers;
    }

    // For HTTPS, filter out sensitive headers
    const filtered: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_HEADERS.includes(lowerKey)) {
        filtered[key] = '[FILTERED]';
      } else {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * Extract modification descriptions from applied rules
   */
  private extractModifications(rules: Rule[]): string[] {
    const modifications: string[] = [];

    for (const rule of rules) {
      switch (rule.action.type) {
        case 'modifyHeaders':
          if (rule.action.requestHeaders) {
            modifications.push(`Modified request headers (${rule.name})`);
          }
          if (rule.action.responseHeaders) {
            modifications.push(`Modified response headers (${rule.name})`);
          }
          break;
        case 'redirect':
          modifications.push(`Redirected to ${rule.action.destination} (${rule.name})`);
          break;
        case 'modifyBody':
          modifications.push(`Modified ${rule.action.target} body (${rule.name})`);
          break;
        case 'mockResponse':
          modifications.push(`Mocked response with status ${rule.action.statusCode} (${rule.name})`);
          break;
      }
    }

    return modifications;
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return `log-${Date.now()}-${this.logIdCounter++}`;
  }
}
