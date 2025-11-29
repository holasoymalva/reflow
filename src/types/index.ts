// Core type definitions for Chrome Request Manager
// These will be expanded in subsequent tasks

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  urlPattern: string | RegExp;
  action: RuleAction;
  createdAt: Date;
  modifiedAt: Date;
}

export type RuleAction = 
  | HeaderModification
  | URLRedirection
  | BodyModification
  | ResponseOverride;

export interface HeaderModification {
  type: 'modifyHeaders';
  requestHeaders?: HeaderOperation[];
  responseHeaders?: HeaderOperation[];
}

export interface HeaderOperation {
  operation: 'set' | 'remove' | 'append';
  header: string;
  value?: string;
}

export interface URLRedirection {
  type: 'redirect';
  destination: string;
  regexSubstitution?: string;
}

export interface BodyModification {
  type: 'modifyBody';
  target: 'request' | 'response';
  contentType: 'json' | 'text' | 'binary';
  modification: JSONPathModification | FullReplacement;
}

export interface JSONPathModification {
  type: 'jsonPath';
  path: string;
  value: any;
}

export interface FullReplacement {
  type: 'replace';
  content: string | ArrayBuffer;
}

export interface ResponseOverride {
  type: 'mockResponse';
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  url: string;
  method: string;
  statusCode?: number;
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  appliedRules: string[];
  modifications: string[];
}

export interface LogFilter {
  urlPattern?: string;
  method?: string;
  statusCode?: number;
  hasModifications?: boolean;
  dateRange?: { start: Date; end: Date };
}

export interface ExtensionConfig {
  globalPaused: boolean;
  logRetentionDays: number;
  maxLogEntries: number;
  enableHTTPS: boolean;
  theme: 'light' | 'dark' | 'auto';
}

export interface ExportData {
  version: string;
  exportDate: Date;
  rules: Rule[];
  config: ExtensionConfig;
}

export interface ImportResult {
  success: boolean;
  importedRules: number;
  skippedRules: number;
  errors: string[];
}

// Validation functions
export function isValidURLPattern(pattern: string): boolean {
  // Check if it's a valid wildcard pattern or regex
  try {
    // Try to parse as regex
    new RegExp(pattern);
    return true;
  } catch (e) {
    // If regex fails, check if it's a valid wildcard pattern
    // Wildcard patterns use * for any characters
    // Valid wildcard: contains only alphanumeric, *, /, :, ., -, _, ?, &, =
    const wildcardRegex = /^[a-zA-Z0-9*/:.\-_?&=]+$/;
    return wildcardRegex.test(pattern);
  }
}

export function isValidHeaderName(name: string): boolean {
  // HTTP header names must follow RFC 7230
  // Valid characters: alphanumeric, hyphen, underscore
  // Must not be empty
  if (!name || name.length === 0) {
    return false;
  }
  
  // Header names are case-insensitive and consist of alphanumeric characters and hyphens
  const headerNameRegex = /^[a-zA-Z0-9\-]+$/;
  return headerNameRegex.test(name);
}
