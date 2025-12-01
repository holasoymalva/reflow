import { Rule, HeaderModification, URLRedirection, BodyModification, ErrorCode, ExtensionError } from '../types';

export interface RequestInfo {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string | ArrayBuffer;
}

export interface ModifiedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string | ArrayBuffer;
  modifications: string[];
}

// Security-sensitive headers that cannot be modified by extensions
const SECURITY_RESTRICTED_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'set-cookie',
  'set-cookie2',
  'origin',
  'referer',
  'user-agent',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'via'
]);

export class RuleEngine {
  /**
   * Evaluates if a rule matches a given request
   */
  evaluateRule(rule: Rule, request: RequestInfo): boolean {
    if (!rule.enabled) {
      return false;
    }

    return this.matchesURLPattern(rule.urlPattern, request.url);
  }

  /**
   * Matches a URL against a pattern (regex or wildcard)
   */
  private matchesURLPattern(pattern: string | RegExp, url: string): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(url);
    }

    // Convert wildcard pattern to regex
    // * matches any characters
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*'); // Convert * to .*

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
  }

  /**
   * Sorts rules by priority (descending order - higher priority first)
   */
  sortByPriority(rules: Rule[]): Rule[] {
    return [...rules].sort((a, b) => b.priority - a.priority);
  }

  /**
   * Applies a rule to a request and returns the modified request
   */
  applyRule(rule: Rule, request: RequestInfo): ModifiedRequest {
    const modified: ModifiedRequest = {
      url: request.url,
      method: request.method,
      headers: { ...request.headers },
      body: request.body,
      modifications: []
    };

    switch (rule.action.type) {
      case 'modifyHeaders':
        return this.applyHeaderModifications(rule.action, modified);
      case 'redirect':
        return this.applyURLRedirection(rule.action, modified, request);
      case 'modifyBody':
        return this.applyBodyModification(rule.action, modified);
      case 'mockResponse':
        // Mock responses are handled differently in the service worker
        modified.modifications.push(`Mock response: ${rule.action.statusCode}`);
        return modified;
      default:
        return modified;
    }
  }

  /**
   * Applies header modifications to a request
   */
  applyHeaderModifications(
    action: HeaderModification,
    modified: ModifiedRequest
  ): ModifiedRequest {
    const operations = action.requestHeaders || [];
    const conflicts: string[] = [];

    for (const op of operations) {
      const headerName = op.header.toLowerCase();

      // Check for security conflicts
      if (SECURITY_RESTRICTED_HEADERS.has(headerName)) {
        conflicts.push(headerName);
        modified.modifications.push(`Skipped restricted header: ${op.header}`);
        continue;
      }

      switch (op.operation) {
        case 'set':
          modified.headers[op.header] = op.value || '';
          modified.modifications.push(`Set header: ${op.header} = ${op.value}`);
          break;
        case 'remove':
          delete modified.headers[op.header];
          modified.modifications.push(`Removed header: ${op.header}`);
          break;
        case 'append':
          if (modified.headers[op.header]) {
            modified.headers[op.header] += `, ${op.value}`;
          } else {
            modified.headers[op.header] = op.value || '';
          }
          modified.modifications.push(`Appended header: ${op.header} += ${op.value}`);
          break;
      }
    }

    return modified;
  }

  /**
   * Applies URL redirection to a request
   */
  applyURLRedirection(
    action: URLRedirection,
    modified: ModifiedRequest,
    originalRequest: RequestInfo
  ): ModifiedRequest {
    try {
      let newURL: string;

      if (action.regexSubstitution) {
        // Regex-based replacement
        const regex = new RegExp(action.destination);
        newURL = originalRequest.url.replace(regex, action.regexSubstitution);
      } else {
        // Static URL
        newURL = action.destination;
      }

      // Validate the new URL
      new URL(newURL); // Throws if invalid

      modified.url = newURL;
      modified.modifications.push(`Redirected to: ${newURL}`);
    } catch (error) {
      // Invalid URL - log error and keep original
      const message = error instanceof Error ? error.message : String(error);
      modified.modifications.push(`Error: Invalid URL redirection - ${message}`);
      console.error(new ExtensionError(
        `Invalid URL modification: ${message}`,
        ErrorCode.VALIDATION_ERROR,
        true,
        'URL redirection failed due to invalid URL format.'
      ));
    }

    return modified;
  }

  /**
   * Applies body modification to a request
   */
  applyBodyModification(
    action: BodyModification,
    modified: ModifiedRequest
  ): ModifiedRequest {
    if (!modified.body) {
      modified.modifications.push('No body to modify');
      return modified;
    }

    try {
      switch (action.contentType) {
        case 'json':
          modified = this.modifyJSONBody(action, modified);
          break;
        case 'text':
          modified = this.modifyTextBody(action, modified);
          break;
        case 'binary':
          modified = this.modifyBinaryBody(action, modified);
          break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      modified.modifications.push(`Error modifying body: ${message}`);
      console.error(new ExtensionError(
        `Body modification failed: ${message}`,
        ErrorCode.NETWORK_ERROR,
        true,
        'Failed to modify request/response body.'
      ));
    }

    return modified;
  }

  private modifyJSONBody(
    action: BodyModification,
    modified: ModifiedRequest
  ): ModifiedRequest {
    const bodyStr = typeof modified.body === 'string' 
      ? modified.body 
      : new TextDecoder().decode(modified.body as ArrayBuffer);

    let jsonData = JSON.parse(bodyStr);

    if (action.modification.type === 'jsonPath') {
      // Simple JSON path implementation
      jsonData = this.applyJSONPath(jsonData, action.modification.path, action.modification.value);
      modified.modifications.push(`Modified JSON path: ${action.modification.path}`);
    } else {
      // Full replacement
      const content = action.modification.content;
      jsonData = typeof content === 'string' ? JSON.parse(content) : content;
      modified.modifications.push('Replaced entire JSON body');
    }

    const newBody = JSON.stringify(jsonData);
    modified.body = newBody;
    modified.headers['Content-Length'] = String(new TextEncoder().encode(newBody).length);

    return modified;
  }

  private modifyTextBody(
    action: BodyModification,
    modified: ModifiedRequest
  ): ModifiedRequest {
    if (action.modification.type === 'replace') {
      const content = action.modification.content as string;
      modified.body = content;
      modified.headers['Content-Length'] = String(new TextEncoder().encode(content).length);
      modified.modifications.push('Replaced text body');
    }

    return modified;
  }

  private modifyBinaryBody(
    action: BodyModification,
    modified: ModifiedRequest
  ): ModifiedRequest {
    if (action.modification.type === 'replace') {
      const content = action.modification.content;
      modified.body = content;
      const length = content instanceof ArrayBuffer 
        ? content.byteLength 
        : new TextEncoder().encode(content as string).length;
      modified.headers['Content-Length'] = String(length);
      modified.modifications.push('Replaced binary body');
    }

    return modified;
  }

  /**
   * Simple JSON path implementation
   * Supports dot notation: "user.name", "items[0].id"
   */
  private applyJSONPath(obj: any, path: string, value: any): any {
    const parts = path.split('.');
    const lastPart = parts.pop()!;
    
    let current = obj;
    for (const part of parts) {
      // Handle array indices
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        current = current[key][parseInt(index)];
      } else {
        current = current[part];
      }
    }

    // Handle array index in last part
    const arrayMatch = lastPart.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current[key][parseInt(index)] = value;
    } else {
      current[lastPart] = value;
    }

    return obj;
  }

  /**
   * Converts rules to Chrome declarativeNetRequest format
   */
  convertToDeclarativeRules(rules: Rule[]): chrome.declarativeNetRequest.Rule[] {
    const declarativeRules: chrome.declarativeNetRequest.Rule[] = [];

    for (const rule of rules) {
      if (!rule.enabled) {
        continue;
      }

      // Only certain actions can be converted to declarativeNetRequest
      if (rule.action.type === 'modifyHeaders') {
        declarativeRules.push(this.convertHeaderRule(rule));
      } else if (rule.action.type === 'redirect') {
        declarativeRules.push(this.convertRedirectRule(rule));
      }
      // Body modifications and mock responses require webRequest API fallback
    }

    return declarativeRules;
  }

  private convertHeaderRule(rule: Rule): chrome.declarativeNetRequest.Rule {
    const action = rule.action as HeaderModification;
    const requestHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [];
    const responseHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [];

    if (action.requestHeaders) {
      for (const op of action.requestHeaders) {
        requestHeaders.push({
          header: op.header,
          operation: op.operation as any,
          value: op.value
        });
      }
    }

    if (action.responseHeaders) {
      for (const op of action.responseHeaders) {
        responseHeaders.push({
          header: op.header,
          operation: op.operation as any,
          value: op.value
        });
      }
    }

    return {
      id: parseInt(rule.id) || Math.floor(Math.random() * 1000000),
      priority: rule.priority,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
        requestHeaders,
        responseHeaders
      },
      condition: {
        urlFilter: typeof rule.urlPattern === 'string' ? rule.urlPattern : rule.urlPattern.source,
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME]
      }
    };
  }

  private convertRedirectRule(rule: Rule): chrome.declarativeNetRequest.Rule {
    const action = rule.action as URLRedirection;

    return {
      id: parseInt(rule.id) || Math.floor(Math.random() * 1000000),
      priority: rule.priority,
      action: {
        type: chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: {
          url: action.destination
        }
      },
      condition: {
        urlFilter: typeof rule.urlPattern === 'string' ? rule.urlPattern : rule.urlPattern.source,
        resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME]
      }
    };
  }
}
