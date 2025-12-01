// Service Worker for Chrome Request Manager
import { StorageManager } from '../storage/StorageManager';
import { RuleEngine } from '../rules/RuleEngine';
import { Logger } from '../logger/Logger';
import { Rule, ExtensionConfig } from '../types';

// Global instances
let storageManager: StorageManager;
let ruleEngine: RuleEngine;
let logger: Logger;
let currentConfig: ExtensionConfig;
let activeRules: Rule[] = [];

/**
 * Initialize the extension on install
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Chrome Request Manager installed');
  await initialize();
});

/**
 * Initialize the extension on browser startup
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('Chrome Request Manager starting up');
  await initialize();
});

/**
 * Initialize all components and load persisted data
 */
async function initialize(): Promise<void> {
  try {
    // Initialize managers
    storageManager = new StorageManager();
    ruleEngine = new RuleEngine();
    logger = new Logger();

    // Load persisted configuration
    currentConfig = await storageManager.loadConfig();
    console.log('Loaded config:', currentConfig);

    // Load persisted rules
    activeRules = await storageManager.loadRules();
    console.log(`Loaded ${activeRules.length} rules`);

    // Load persisted logs
    const logs = await storageManager.loadLogs();
    logger.setLogs(logs);
    console.log(`Loaded ${logs.length} log entries`);

    // Apply log retention policy
    await logger.applyRetentionPolicy(
      currentConfig.logRetentionDays,
      currentConfig.maxLogEntries
    );

    // Save cleaned logs back to storage
    await storageManager.saveLogs(logger.getAllLogs());

    // Set up declarativeNetRequest rules
    await updateDeclarativeRules();

    // Set up rule matched listener for logging
    setupRuleMatchedListener();

    // Set up webRequest listeners if needed
    setupWebRequestListeners();

    console.log('Initialization complete');
  } catch (error) {
    console.error('Failed to initialize extension:', error);
    // Continue with default values if initialization fails
    storageManager = new StorageManager();
    ruleEngine = new RuleEngine();
    logger = new Logger();
    activeRules = [];
    currentConfig = {
      globalPaused: false,
      logRetentionDays: 7,
      maxLogEntries: 1000,
      enableHTTPS: false,
      theme: 'auto'
    };
  }
}

/**
 * Update declarativeNetRequest rules
 */
async function updateDeclarativeRules(): Promise<void> {
  try {
    if (!currentConfig || currentConfig.globalPaused) {
      // If paused, remove all dynamic rules
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(r => r.id);
      
      if (ruleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds
        });
      }
      console.log('Removed all dynamic rules (paused or not configured)');
      return;
    }

    // Convert rules to declarativeNetRequest format
    const declarativeRules = ruleEngine.convertToDeclarativeRules(activeRules);

    // Get existing dynamic rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingRuleIds = existingRules.map(r => r.id);

    // Update dynamic rules
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRuleIds,
      addRules: declarativeRules
    });

    console.log(`Updated ${declarativeRules.length} declarativeNetRequest rules`);
  } catch (error) {
    console.error('Failed to update declarativeNetRequest rules:', error);
  }
}

/**
 * Set up onRuleMatchedDebug listener for logging
 */
function setupRuleMatchedListener(): void {
  // Note: onRuleMatchedDebug requires the extension to be in developer mode
  if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
    chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
      console.log('Rule matched:', info);
      
      // Find the rule that was matched
      const matchedRule = activeRules.find(r => parseInt(r.id) === info.rule.ruleId);
      
      if (matchedRule) {
        // Log the request
        const requestInfo = {
          url: info.request.url,
          method: info.request.method,
          headers: {},
          timestamp: new Date()
        };
        
        logger.logRequest(requestInfo, [matchedRule]);
        
        // Persist logs periodically
        persistLogsDebounced();
      }
    });
  }
}

// Debounced log persistence to avoid excessive storage writes
let logPersistTimer: NodeJS.Timeout | null = null;
function persistLogsDebounced(): void {
  if (logPersistTimer) {
    clearTimeout(logPersistTimer);
  }
  
  logPersistTimer = setTimeout(async () => {
    try {
      await storageManager.saveLogs(logger.getAllLogs());
    } catch (error) {
      console.error('Failed to persist logs:', error);
    }
  }, 1000);
}

/**
 * Check if any rules require webRequest API fallback
 */
function needsWebRequestFallback(): boolean {
  return activeRules.some(rule => 
    rule.enabled && (
      rule.action.type === 'modifyBody' || 
      rule.action.type === 'mockResponse'
    )
  );
}

/**
 * Set up webRequest API listeners for complex rules
 */
function setupWebRequestListeners(): void {
  // Only set up if we have rules that need it and HTTPS is enabled
  if (!needsWebRequestFallback() || !currentConfig.enableHTTPS) {
    return;
  }

  // BeforeRequest listener for body modifications and mock responses
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (currentConfig.globalPaused) {
        // Log but don't modify when paused
        const requestInfo = {
          url: details.url,
          method: details.method,
          headers: {},
          timestamp: new Date()
        };
        logger.logRequest(requestInfo, []);
        persistLogsDebounced();
        return {};
      }

      // Find matching rules that need webRequest
      const matchingRules = activeRules.filter(rule => {
        if (!rule.enabled) return false;
        if (rule.action.type !== 'modifyBody' && rule.action.type !== 'mockResponse') return false;
        
        const requestInfo = {
          url: details.url,
          method: details.method,
          headers: {}
        };
        
        return ruleEngine.evaluateRule(rule, requestInfo);
      });

      if (matchingRules.length === 0) {
        return {};
      }

      // Sort by priority
      const sortedRules = ruleEngine.sortByPriority(matchingRules);
      
      // Apply the highest priority rule
      const rule = sortedRules[0];
      
      try {
        if (rule.action.type === 'mockResponse') {
          // Mock response
          const mockAction = rule.action;
          
          // Log the request
          const requestInfo = {
            url: details.url,
            method: details.method,
            headers: {},
            timestamp: new Date()
          };
          logger.logRequest(requestInfo, [rule]);
          persistLogsDebounced();
          
          // Return mock response
          return {
            redirectUrl: `data:text/plain;charset=utf-8,${encodeURIComponent(mockAction.body)}`
          };
        } else if (rule.action.type === 'modifyBody') {
          // Body modification
          // Note: Chrome extensions have limited ability to modify request bodies
          // This is a best-effort implementation
          
          const requestInfo = {
            url: details.url,
            method: details.method,
            headers: {},
            timestamp: new Date()
          };
          
          logger.logRequest(requestInfo, [rule]);
          persistLogsDebounced();
          
          // Log that body modification was attempted
          console.log('Body modification attempted for:', details.url);
        }
      } catch (error) {
        console.error('Error in webRequest handler:', error);
        
        // Log HTTPS modification failure if applicable
        if (details.url.startsWith('https://')) {
          console.error('HTTPS modification failed:', error);
          const requestInfo = {
            url: details.url,
            method: details.method,
            headers: {},
            timestamp: new Date()
          };
          logger.logRequest(requestInfo, []);
          persistLogsDebounced();
        }
      }

      return {};
    },
    { urls: ['<all_urls>'] },
    ['requestBody']
  );

  // BeforeSendHeaders listener for HTTPS request interception
  chrome.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      const isHTTPS = details.url.startsWith('https://');
      
      // Log HTTPS requests
      if (isHTTPS) {
        const headers: Record<string, string> = {};
        if (details.requestHeaders) {
          for (const header of details.requestHeaders) {
            if (header.name && header.value) {
              headers[header.name] = header.value;
            }
          }
        }
        
        const requestInfo = {
          url: details.url,
          method: details.method,
          headers,
          timestamp: new Date()
        };
        
        // Find matching rules
        const matchingRules = activeRules.filter(rule => {
          if (!rule.enabled || currentConfig.globalPaused) return false;
          return ruleEngine.evaluateRule(rule, requestInfo);
        });
        
        if (matchingRules.length > 0) {
          logger.logRequest(requestInfo, matchingRules);
          persistLogsDebounced();
        }
      }
      
      return {};
    },
    { urls: ['<all_urls>'] },
    ['requestHeaders']
  );
}

/**
 * Remove webRequest listeners
 */
function removeWebRequestListeners(): void {
  // Note: Chrome's webRequest API doesn't provide a clean way to remove all listeners
  // This is a placeholder for future implementation if needed
  console.log('WebRequest listeners cleanup requested');
}

/**
 * Message types for UI communication
 */
type Message = 
  | { type: 'getRules' }
  | { type: 'createRule'; payload: Omit<Rule, 'id' | 'createdAt' | 'modifiedAt'> }
  | { type: 'updateRule'; payload: { id: string; updates: Partial<Rule> } }
  | { type: 'deleteRule'; payload: { id: string } }
  | { type: 'toggleRule'; payload: { id: string; enabled: boolean } }
  | { type: 'toggleGlobalPause'; payload: { paused: boolean } }
  | { type: 'getLogs'; payload: { filter?: any } }
  | { type: 'clearLogs' }
  | { type: 'exportData' }
  | { type: 'importData'; payload: { data: any } };

type Response = 
  | { success: true; data: any }
  | { success: false; error: string };

/**
 * Handle messages from UI
 */
async function handleMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender
): Promise<Response> {
  try {
    switch (message.type) {
      case 'getRules':
        return { success: true, data: activeRules };

      case 'createRule': {
        // Validate rule name uniqueness
        const existingNames = new Set(activeRules.map(r => r.name));
        if (existingNames.has(message.payload.name)) {
          return { 
            success: false, 
            error: `Rule with name "${message.payload.name}" already exists` 
          };
        }

        // Create new rule
        const newRule: Rule = {
          ...message.payload,
          id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          createdAt: new Date(),
          modifiedAt: new Date()
        };

        activeRules.push(newRule);
        
        // Persist to storage
        await storageManager.saveRules(activeRules);
        
        // Update declarativeNetRequest rules
        await updateDeclarativeRules();
        
        // Update webRequest listeners if needed
        if (needsWebRequestFallback()) {
          setupWebRequestListeners();
        }

        return { success: true, data: newRule };
      }

      case 'updateRule': {
        const ruleIndex = activeRules.findIndex(r => r.id === message.payload.id);
        
        if (ruleIndex === -1) {
          return { success: false, error: 'Rule not found' };
        }

        // Check name uniqueness if name is being updated
        if (message.payload.updates.name) {
          const existingNames = new Set(
            activeRules
              .filter(r => r.id !== message.payload.id)
              .map(r => r.name)
          );
          
          if (existingNames.has(message.payload.updates.name)) {
            return { 
              success: false, 
              error: `Rule with name "${message.payload.updates.name}" already exists` 
            };
          }
        }

        // Update rule
        activeRules[ruleIndex] = {
          ...activeRules[ruleIndex],
          ...message.payload.updates,
          modifiedAt: new Date()
        };

        // Persist to storage
        await storageManager.saveRules(activeRules);
        
        // Update declarativeNetRequest rules
        await updateDeclarativeRules();
        
        // Update webRequest listeners if needed
        if (needsWebRequestFallback()) {
          setupWebRequestListeners();
        } else {
          removeWebRequestListeners();
        }

        return { success: true, data: activeRules[ruleIndex] };
      }

      case 'deleteRule': {
        const ruleIndex = activeRules.findIndex(r => r.id === message.payload.id);
        
        if (ruleIndex === -1) {
          return { success: false, error: 'Rule not found' };
        }

        // Remove rule
        activeRules.splice(ruleIndex, 1);

        // Persist to storage
        await storageManager.saveRules(activeRules);
        
        // Update declarativeNetRequest rules
        await updateDeclarativeRules();
        
        // Update webRequest listeners if needed
        if (!needsWebRequestFallback()) {
          removeWebRequestListeners();
        }

        return { success: true, data: null };
      }

      case 'toggleRule': {
        const ruleIndex = activeRules.findIndex(r => r.id === message.payload.id);
        
        if (ruleIndex === -1) {
          return { success: false, error: 'Rule not found' };
        }

        // Toggle rule
        activeRules[ruleIndex].enabled = message.payload.enabled;
        activeRules[ruleIndex].modifiedAt = new Date();

        // Persist to storage
        await storageManager.saveRules(activeRules);
        
        // Update declarativeNetRequest rules
        await updateDeclarativeRules();

        return { success: true, data: activeRules[ruleIndex] };
      }

      case 'toggleGlobalPause': {
        currentConfig.globalPaused = message.payload.paused;

        // Persist config
        await storageManager.saveConfig(currentConfig);
        
        // Update declarativeNetRequest rules (will remove all if paused)
        await updateDeclarativeRules();

        return { success: true, data: currentConfig };
      }

      case 'getLogs': {
        const logs = await logger.getLogs(message.payload.filter);
        return { success: true, data: logs };
      }

      case 'clearLogs': {
        await logger.clearLogs();
        await storageManager.saveLogs([]);
        return { success: true, data: null };
      }

      case 'exportData': {
        const exportData = await storageManager.exportData();
        return { success: true, data: exportData };
      }

      case 'importData': {
        const importResult = await storageManager.importData(message.payload.data);
        
        // Reload rules after import
        activeRules = await storageManager.loadRules();
        
        // Update declarativeNetRequest rules
        await updateDeclarativeRules();
        
        // Update webRequest listeners if needed
        if (needsWebRequestFallback()) {
          setupWebRequestListeners();
        }

        return { success: true, data: importResult };
      }

      case 'getConfig': {
        return { success: true, data: currentConfig };
      }

      case 'updateConfig': {
        // Update config
        currentConfig = {
          ...currentConfig,
          ...message.payload.config
        };

        // Persist config
        await storageManager.saveConfig(currentConfig);

        // Apply log retention policy if those settings changed
        if (message.payload.config.logRetentionDays !== undefined || 
            message.payload.config.maxLogEntries !== undefined) {
          await logger.applyRetentionPolicy(
            currentConfig.logRetentionDays,
            currentConfig.maxLogEntries
          );
          await storageManager.saveLogs(logger.getAllLogs());
        }

        return { success: true, data: currentConfig };
      }

      case 'clearAllData': {
        // Clear all rules
        activeRules = [];
        await storageManager.saveRules([]);

        // Clear all logs
        await logger.clearLogs();
        await storageManager.saveLogs([]);

        // Reset config to defaults
        currentConfig = {
          globalPaused: false,
          logRetentionDays: 7,
          maxLogEntries: 1000,
          enableHTTPS: false,
          theme: 'auto'
        };
        await storageManager.saveConfig(currentConfig);

        // Update declarativeNetRequest rules (will remove all)
        await updateDeclarativeRules();

        // Remove webRequest listeners
        removeWebRequestListeners();

        return { success: true, data: null };
      }

      default:
        return { success: false, error: 'Unknown message type' };
    }
  } catch (error) {
    console.error('Error handling message:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// Set up message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then(response => sendResponse(response))
    .catch(error => sendResponse({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }));
  
  // Return true to indicate we'll send response asynchronously
  return true;
});

// Export for testing
export { 
  initialize, 
  storageManager, 
  ruleEngine, 
  logger, 
  currentConfig, 
  activeRules,
  updateDeclarativeRules,
  setupRuleMatchedListener,
  setupWebRequestListeners,
  removeWebRequestListeners,
  needsWebRequestFallback,
  handleMessage
};

export type { Message, Response };
