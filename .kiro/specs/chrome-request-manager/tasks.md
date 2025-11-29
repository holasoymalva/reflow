# Implementation Plan

- [x] 1. Set up project structure and configuration
  - Create Chrome extension manifest.json (Manifest V3)
  - Set up TypeScript configuration
  - Configure build system (webpack/vite)
  - Set up testing framework (Jest + fast-check)
  - Create directory structure: src/{background, ui, storage, rules, logger, types}
  - _Requirements: All_

- [x] 2. Implement core data models and types
  - [x] 2.1 Define TypeScript interfaces for Rule, RuleAction, and all action subtypes
    - Create types for HeaderModification, URLRedirection, BodyModification, ResponseOverride
    - Define LogEntry, LogFilter, ExtensionConfig interfaces
    - _Requirements: 1.1, 2.1, 3.1, 4.1_
  
  - [x] 2.2 Write property test for URL pattern validation
    - **Property 2: URL pattern validation correctness**
    - **Validates: Requirements 1.2**
  
  - [x] 2.3 Write property test for header name validation
    - **Property 6: Header name validation correctness**
    - **Validates: Requirements 2.2**

- [ ] 3. Implement Storage Manager
  - [ ] 3.1 Create StorageManager class with chrome.storage.local integration
    - Implement saveRules, loadRules methods
    - Implement saveConfig, loadConfig methods
    - Implement saveLogs, loadLogs methods with size limits
    - Add error handling for storage quota exceeded
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ] 3.2 Write property test for rule persistence round trip
    - **Property 1: Rule persistence round trip**
    - **Validates: Requirements 9.1, 9.2**
  
  - [ ] 3.3 Write property test for storage synchronization timing
    - **Property 28: Storage synchronization timing**
    - **Validates: Requirements 9.4**
  
  - [ ] 3.4 Write property test for storage failure resilience
    - **Property 29: Storage failure resilience**
    - **Validates: Requirements 9.3**
  
  - [ ] 3.5 Implement export and import functionality
    - Create exportData method that generates ExportData JSON
    - Create importData method with validation
    - Add duplicate name detection logic
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ] 3.6 Write property test for export completeness
    - **Property 19: Export completeness**
    - **Validates: Requirements 6.1, 6.4**
  
  - [ ] 3.7 Write property test for import validation
    - **Property 20: Import validation and addition**
    - **Validates: Requirements 6.2, 6.5**
  
  - [ ] 3.8 Write property test for export-import round trip
    - **Property 22: Export-import round trip**
    - **Validates: Requirements 6.1, 6.2**
  
  - [ ] 3.9 Write property test for duplicate detection
    - **Property 21: Import duplicate detection**
    - **Validates: Requirements 6.3**

- [ ] 4. Implement Rule Engine
  - [ ] 4.1 Create RuleEngine class with pattern matching logic
    - Implement URL pattern matching (regex and wildcard support)
    - Create evaluateRule method to check if request matches rule
    - Implement rule priority sorting
    - _Requirements: 1.2, 1.3, 2.4_
  
  - [ ] 4.2 Write property test for rule activation state effect
    - **Property 3: Rule activation state effect**
    - **Validates: Requirements 1.3, 1.4**
  
  - [ ] 4.3 Write property test for rule priority ordering
    - **Property 7: Rule priority ordering**
    - **Validates: Requirements 2.4**
  
  - [ ] 4.4 Implement header modification logic
    - Create applyHeaderModifications method
    - Support set, remove, append operations
    - Add validation for HTTP header names
    - Implement security policy conflict detection
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  
  - [ ] 4.5 Write property test for header modification completeness
    - **Property 5: Header modification completeness**
    - **Validates: Requirements 2.1, 2.3**
  
  - [ ] 4.6 Write property test for security conflict handling
    - **Property 8: Security conflict handling**
    - **Validates: Requirements 2.5**
  
  - [ ] 4.7 Implement URL redirection logic
    - Create applyURLRedirection method
    - Support static URLs and regex-based replacements
    - Preserve request method and body by default
    - Add invalid URL detection and error handling
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [ ] 4.8 Write property test for URL redirection correctness
    - **Property 9: URL redirection correctness**
    - **Validates: Requirements 3.1, 3.2**
  
  - [ ] 4.9 Write property test for URL modification invariant preservation
    - **Property 10: URL modification invariant preservation**
    - **Validates: Requirements 3.3**
  
  - [ ] 4.10 Write property test for invalid URL modification fallback
    - **Property 11: Invalid URL modification fallback**
    - **Validates: Requirements 3.4**
  
  - [ ] 4.11 Implement body modification logic
    - Create applyBodyModification method
    - Support JSON, text, and binary content types
    - Implement JSON path modification
    - Update Content-Length header after modification
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ] 4.12 Write property test for body modification application
    - **Property 12: Body modification application**
    - **Validates: Requirements 4.1, 4.2**
  
  - [ ] 4.13 Write property test for content-length consistency
    - **Property 13: Body modification content-length consistency**
    - **Validates: Requirements 4.3**
  
  - [ ] 4.14 Write property test for JSON path modification precision
    - **Property 14: JSON path modification precision**
    - **Validates: Requirements 4.4**
  
  - [ ] 4.15 Convert rules to chrome.declarativeNetRequest format
    - Create convertToDeclarativeRules method
    - Map rule actions to declarativeNetRequest actions
    - Handle rules that require webRequest API fallback
    - _Requirements: 1.1, 2.1, 3.1_

- [ ] 5. Implement Logger
  - [ ] 5.1 Create Logger class with request/response logging
    - Implement logRequest and logResponse methods
    - Capture URL, method, headers, timestamp, status code
    - Record applied rules and modifications
    - Add sensitive data filtering for HTTPS
    - _Requirements: 5.1, 5.2, 8.3_
  
  - [ ] 5.2 Write property test for log entry completeness
    - **Property 15: Request log completeness**
    - **Validates: Requirements 5.1, 5.2**
  
  - [ ] 5.3 Write property test for HTTPS sensitive data protection
    - **Property 26: HTTPS sensitive data protection**
    - **Validates: Requirements 8.3**
  
  - [ ] 5.4 Implement log filtering and retrieval
    - Create getLogs method with LogFilter support
    - Filter by URL pattern, method, status code, date range
    - Sort logs chronologically
    - _Requirements: 5.3, 5.4_
  
  - [ ] 5.5 Write property test for log chronological ordering
    - **Property 16: Log chronological ordering**
    - **Validates: Requirements 5.3**
  
  - [ ] 5.6 Write property test for log filtering correctness
    - **Property 17: Log filtering correctness**
    - **Validates: Requirements 5.4**
  
  - [ ] 5.7 Implement log retention and cleanup
    - Create clearLogs method with date-based deletion
    - Implement automatic log rotation based on retention period
    - Add max log entries limit
    - _Requirements: 5.5_
  
  - [ ] 5.8 Write property test for log retention policy
    - **Property 18: Log retention policy enforcement**
    - **Validates: Requirements 5.5**

- [ ] 6. Implement Service Worker (Background Script)
  - [ ] 6.1 Create service worker entry point
    - Set up chrome.runtime event listeners (onInstalled, onStartup)
    - Initialize StorageManager, RuleEngine, Logger instances
    - Load persisted rules and config on startup
    - _Requirements: 9.2_
  
  - [ ] 6.2 Implement declarativeNetRequest integration
    - Register dynamic rules using chrome.declarativeNetRequest.updateDynamicRules
    - Handle rule updates when user creates/modifies rules
    - Set up onRuleMatchedDebug listener for logging
    - _Requirements: 1.1, 1.3, 2.1, 3.1, 4.1_
  
  - [ ] 6.3 Implement webRequest API fallback for complex rules
    - Set up chrome.webRequest listeners for rules requiring dynamic inspection
    - Handle body modifications that can't use declarativeNetRequest
    - Implement HTTPS request interception
    - _Requirements: 4.1, 8.1_
  
  - [ ] 6.4 Write property test for HTTPS request interception
    - **Property 25: HTTPS request interception**
    - **Validates: Requirements 8.1**
  
  - [ ] 6.5 Write property test for HTTPS modification failure logging
    - **Property 27: HTTPS modification failure logging**
    - **Validates: Requirements 8.4**
  
  - [ ] 6.6 Implement message passing protocol
    - Create handleMessage function for UI communication
    - Handle getRules, createRule, updateRule, deleteRule, toggleRule messages
    - Handle toggleGlobalPause, getLogs, clearLogs messages
    - Handle exportData, importData messages
    - Return appropriate Response objects
    - _Requirements: 1.1, 1.3, 1.4, 5.3, 6.1, 6.2, 10.1, 10.2_
  
  - [ ] 6.7 Implement global pause functionality
    - Add global pause state management
    - Disable rule application when paused
    - Continue logging with "unmodified" marker during pause
    - Persist pause state to storage
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ] 6.8 Write property test for global pause effectiveness
    - **Property 31: Global pause effectiveness**
    - **Validates: Requirements 10.1, 10.3**
  
  - [ ] 6.9 Write property test for global pause state persistence
    - **Property 32: Global pause state persistence**
    - **Validates: Requirements 10.4, 10.5**
  
  - [ ] 6.10 Implement rule name uniqueness validation
    - Add validation in createRule handler
    - Check for duplicate names before adding new rules
    - _Requirements: 1.5_
  
  - [ ] 6.11 Write property test for rule name uniqueness
    - **Property 4: Rule name uniqueness enforcement**
    - **Validates: Requirements 1.5**

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Build UI components foundation
  - [ ] 8.1 Set up React with TypeScript
    - Configure React build pipeline
    - Create shared UI utilities and hooks
    - Set up chrome.runtime.sendMessage wrapper for UI-to-background communication
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ] 8.2 Create UIController utility class
    - Implement sendMessage wrapper
    - Create methods for all message types (createRule, updateRule, etc.)
    - Add error handling and type safety
    - _Requirements: 1.1, 1.3, 1.4, 5.3, 10.1_

- [ ] 9. Implement Popup UI
  - [ ] 9.1 Create popup HTML and React root
    - Set up popup.html with React mount point
    - Create Popup component structure
    - _Requirements: 7.1_
  
  - [ ] 9.2 Implement rule list display
    - Fetch rules from background on popup open
    - Display all rules with name, status (enabled/disabled), and toggle switch
    - Add visual indicators for active rules
    - _Requirements: 7.1_
  
  - [ ] 9.3 Write property test for rule list display completeness
    - **Property 23: Rule list display completeness**
    - **Validates: Requirements 7.1**
  
  - [ ] 9.4 Add global pause toggle button
    - Create prominent pause/resume button
    - Update UI state when pause state changes
    - _Requirements: 10.1, 10.2_
  
  - [ ] 9.5 Add quick access to recent logs
    - Display last 10 log entries
    - Show URL, method, status, and applied rules
    - Add link to full log viewer in options page
    - _Requirements: 5.3_

- [ ] 10. Implement Options Page UI
  - [ ] 10.1 Create options page HTML and React root
    - Set up options.html with React mount point
    - Create tabbed interface (Rules, Logs, Settings)
    - _Requirements: 7.1, 7.2, 7.3_
  
  - [ ] 10.2 Implement Rules tab with full CRUD
    - Display all rules in a table/list
    - Add "Create New Rule" button
    - Add edit and delete buttons for each rule
    - Implement rule detail modal/panel
    - _Requirements: 7.1, 7.2_
  
  - [ ] 10.3 Create rule editor form
    - Add form fields for rule name, URL pattern, priority, action type
    - Create conditional fields based on action type (headers, URL, body)
    - Implement real-time pattern syntax validation
    - Add save and cancel buttons
    - _Requirements: 7.3, 7.4, 7.5_
  
  - [ ] 10.4 Write property test for rule save validation
    - **Property 24: Rule save validation**
    - **Validates: Requirements 7.4**
  
  - [ ] 10.5 Implement Logs tab
    - Display all logs in a table with columns: timestamp, URL, method, status, rules applied
    - Add filter controls (URL pattern, method, status code, date range)
    - Implement log detail view showing full headers and modifications
    - Add clear logs button
    - Add export logs button
    - _Requirements: 5.3, 5.4_
  
  - [ ] 10.6 Implement Settings tab
    - Add log retention period setting
    - Add max log entries setting
    - Add HTTPS interception toggle
    - Add theme selector (light/dark/auto)
    - Add clear all extension data button
    - _Requirements: 5.5, 8.5, 9.5_
  
  - [ ] 10.7 Write property test for extension data clear
    - **Property 30: Extension data clear completeness**
    - **Validates: Requirements 9.5**
  
  - [ ] 10.8 Implement import/export UI
    - Add "Export Rules" button that downloads JSON file
    - Add "Import Rules" button with file picker
    - Show import results (success count, skipped count, errors)
    - Handle duplicate name conflicts with user prompts
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 11. Implement DevTools Panel (optional enhancement)
  - [ ] 11.1 Create devtools panel HTML and React root
    - Set up devtools.html and panel.html
    - Register panel in manifest.json
    - _Requirements: 5.3_
  
  - [ ] 11.2 Implement advanced log viewer
    - Display logs with detailed request/response information
    - Add advanced filtering and search
    - Show request/response headers and bodies
    - Highlight modifications made by rules
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 12. Implement error handling and user notifications
  - [ ] 12.1 Create ErrorHandler utility
    - Implement error logging
    - Create user-friendly error messages
    - Add toast/notification system for UI
    - _Requirements: 2.5, 3.4, 8.4, 9.3_
  
  - [ ] 12.2 Add error boundaries to React components
    - Wrap main UI components in error boundaries
    - Display fallback UI on errors
    - Log errors to background script
    - _Requirements: 9.3_

- [ ] 13. Add Chrome permissions and manifest configuration
  - [ ] 13.1 Configure manifest.json permissions
    - Add declarativeNetRequest, declarativeNetRequestWithHostAccess permissions
    - Add webRequest, webRequestBlocking permissions (for fallback)
    - Add storage permission
    - Add host permissions for <all_urls>
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 8.1, 8.5, 9.1_
  
  - [ ] 13.2 Implement permission request flow
    - Check for required permissions on extension startup
    - Request additional permissions when user enables HTTPS interception
    - Handle permission denial gracefully
    - _Requirements: 8.5_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Build and packaging
  - [ ] 15.1 Configure production build
    - Set up webpack/vite production configuration
    - Minify and optimize code
    - Generate source maps
    - _Requirements: All_
  
  - [ ] 15.2 Create extension package
    - Build extension zip file
    - Test installation in Chrome
    - Verify all functionality works in production build
    - _Requirements: All_
