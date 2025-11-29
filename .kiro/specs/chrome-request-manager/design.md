# Design Document

## Overview

El Chrome Request Manager es una extensión de Chrome que utiliza las APIs de Chrome Extensions (Manifest V3) para interceptar, modificar y registrar solicitudes HTTP/HTTPS. La arquitectura sigue un patrón de separación de responsabilidades con un service worker como núcleo, una interfaz de usuario basada en React, y un sistema de almacenamiento persistente.

La extensión utiliza la API `chrome.declarativeNetRequest` para modificaciones de requests de alto rendimiento y `chrome.webRequest` (cuando sea necesario) para casos más complejos que requieren inspección dinámica del contenido.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Chrome Browser                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    Web Pages                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↕                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Request Interception Layer                 │ │
│  │         (declarativeNetRequest API)                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↕                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                Service Worker                           │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │ Rule Engine  │  │ Logger       │  │ Storage Mgr  │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↕                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  Chrome Storage API                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ↕                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                    UI Layer                             │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │ │
│  │  │ Popup        │  │ Options Page │  │ DevTools     │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. **Request Flow**: Web page → Chrome → Interception Layer → Service Worker (Rule Engine) → Modified Request → Server
2. **Response Flow**: Server → Chrome → Interception Layer → Service Worker (Rule Engine) → Modified Response → Web page
3. **UI Flow**: User → UI Layer → Service Worker → Storage → UI Layer
4. **Logging Flow**: Interception Layer → Service Worker (Logger) → Storage → UI Layer

## Components and Interfaces

### 1. Service Worker (Background Script)

El service worker es el núcleo de la extensión y maneja toda la lógica de negocio.

**Responsibilities:**
- Gestionar el ciclo de vida de la extensión
- Coordinar entre el Rule Engine, Logger y Storage Manager
- Escuchar eventos de Chrome APIs
- Comunicarse con la UI mediante message passing

**Interface:**
```typescript
interface ServiceWorker {
  // Lifecycle
  onInstalled(): void;
  onStartup(): void;
  
  // Message handling
  handleMessage(message: Message, sender: chrome.runtime.MessageSender): Promise<Response>;
  
  // Rule management
  updateRules(rules: Rule[]): Promise<void>;
  toggleGlobalPause(paused: boolean): Promise<void>;
}
```

### 2. Rule Engine

Evalúa y aplica rules a las requests y responses.

**Responsibilities:**
- Convertir rules de usuario a formato de Chrome declarativeNetRequest
- Evaluar patterns de URL contra requests
- Aplicar modificaciones según el tipo de rule
- Gestionar prioridades cuando múltiples rules coinciden

**Interface:**
```typescript
interface RuleEngine {
  // Rule conversion
  convertToDeclarativeRules(rules: Rule[]): chrome.declarativeNetRequest.Rule[];
  
  // Rule evaluation
  evaluateRule(rule: Rule, request: RequestInfo): boolean;
  applyRule(rule: Rule, request: RequestInfo): ModifiedRequest;
  
  // Priority management
  resolvePriorities(matchingRules: Rule[]): Rule[];
}

interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  urlPattern: string | RegExp;
  action: RuleAction;
  createdAt: Date;
  modifiedAt: Date;
}

type RuleAction = 
  | HeaderModification
  | URLRedirection
  | BodyModification
  | ResponseOverride;

interface HeaderModification {
  type: 'modifyHeaders';
  requestHeaders?: HeaderOperation[];
  responseHeaders?: HeaderOperation[];
}

interface HeaderOperation {
  operation: 'set' | 'remove' | 'append';
  header: string;
  value?: string;
}

interface URLRedirection {
  type: 'redirect';
  destination: string;
  regexSubstitution?: string;
}

interface BodyModification {
  type: 'modifyBody';
  target: 'request' | 'response';
  contentType: 'json' | 'text' | 'binary';
  modification: JSONPathModification | FullReplacement;
}

interface JSONPathModification {
  type: 'jsonPath';
  path: string;
  value: any;
}

interface FullReplacement {
  type: 'replace';
  content: string | ArrayBuffer;
}

interface ResponseOverride {
  type: 'mockResponse';
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
```

### 3. Logger

Registra todas las requests interceptadas y las modificaciones aplicadas.

**Responsibilities:**
- Capturar información de requests y responses
- Registrar qué rules se aplicaron
- Gestionar retención de logs
- Proporcionar capacidades de filtrado y búsqueda

**Interface:**
```typescript
interface Logger {
  logRequest(request: RequestInfo, appliedRules: Rule[]): void;
  logResponse(response: ResponseInfo, appliedRules: Rule[]): void;
  
  getLogs(filter?: LogFilter): Promise<LogEntry[]>;
  clearLogs(olderThan?: Date): Promise<void>;
  
  exportLogs(format: 'json' | 'csv'): Promise<Blob>;
}

interface LogEntry {
  id: string;
  timestamp: Date;
  url: string;
  method: string;
  statusCode?: number;
  requestHeaders: Record<string, string>;
  responseHeaders?: Record<string, string>;
  appliedRules: string[]; // Rule IDs
  modifications: string[]; // Description of modifications
}

interface LogFilter {
  urlPattern?: string;
  method?: string;
  statusCode?: number;
  hasModifications?: boolean;
  dateRange?: { start: Date; end: Date };
}
```

### 4. Storage Manager

Gestiona la persistencia de rules, configuraciones y logs.

**Responsibilities:**
- Guardar y cargar rules
- Persistir configuraciones de usuario
- Gestionar logs con límites de tamaño
- Sincronizar datos entre sesiones

**Interface:**
```typescript
interface StorageManager {
  // Rules
  saveRules(rules: Rule[]): Promise<void>;
  loadRules(): Promise<Rule[]>;
  
  // Configuration
  saveConfig(config: ExtensionConfig): Promise<void>;
  loadConfig(): Promise<ExtensionConfig>;
  
  // Logs
  saveLogs(logs: LogEntry[]): Promise<void>;
  loadLogs(limit?: number): Promise<LogEntry[]>;
  
  // Import/Export
  exportData(): Promise<ExportData>;
  importData(data: ExportData): Promise<ImportResult>;
  
  // Cleanup
  clearAll(): Promise<void>;
}

interface ExtensionConfig {
  globalPaused: boolean;
  logRetentionDays: number;
  maxLogEntries: number;
  enableHTTPS: boolean;
  theme: 'light' | 'dark' | 'auto';
}

interface ExportData {
  version: string;
  exportDate: Date;
  rules: Rule[];
  config: ExtensionConfig;
}

interface ImportResult {
  success: boolean;
  importedRules: number;
  skippedRules: number;
  errors: string[];
}
```

### 5. UI Components

#### Popup
Interfaz rápida para ver y activar/desactivar rules.

**Responsibilities:**
- Mostrar lista de rules con estado
- Toggle rápido de rules individuales
- Botón de pausa global
- Acceso rápido a logs recientes

#### Options Page
Interfaz completa para gestionar rules y configuraciones.

**Responsibilities:**
- CRUD completo de rules
- Editor visual de rules con validación
- Importación/exportación de rules
- Configuración de la extensión

#### DevTools Panel
Panel integrado en Chrome DevTools para debugging avanzado.

**Responsibilities:**
- Vista detallada de requests interceptadas
- Filtrado y búsqueda de logs
- Inspección de modificaciones aplicadas
- Exportación de logs

**UI Interface:**
```typescript
interface UIController {
  // Communication with service worker
  sendMessage(message: Message): Promise<Response>;
  
  // Rule management
  createRule(rule: Omit<Rule, 'id' | 'createdAt' | 'modifiedAt'>): Promise<Rule>;
  updateRule(id: string, updates: Partial<Rule>): Promise<Rule>;
  deleteRule(id: string): Promise<void>;
  toggleRule(id: string, enabled: boolean): Promise<void>;
  
  // Global controls
  toggleGlobalPause(paused: boolean): Promise<void>;
  
  // Logs
  fetchLogs(filter?: LogFilter): Promise<LogEntry[]>;
  clearLogs(): Promise<void>;
}
```

## Data Models

### Rule Storage Schema

```typescript
// Stored in chrome.storage.local
interface StorageSchema {
  rules: {
    [ruleId: string]: Rule;
  };
  config: ExtensionConfig;
  logs: LogEntry[];
  metadata: {
    version: string;
    lastSync: Date;
  };
}
```

### Message Protocol

```typescript
type Message = 
  | { type: 'getRules' }
  | { type: 'createRule'; payload: Omit<Rule, 'id' | 'createdAt' | 'modifiedAt'> }
  | { type: 'updateRule'; payload: { id: string; updates: Partial<Rule> } }
  | { type: 'deleteRule'; payload: { id: string } }
  | { type: 'toggleRule'; payload: { id: string; enabled: boolean } }
  | { type: 'toggleGlobalPause'; payload: { paused: boolean } }
  | { type: 'getLogs'; payload: { filter?: LogFilter } }
  | { type: 'clearLogs' }
  | { type: 'exportData' }
  | { type: 'importData'; payload: { data: ExportData } };

type Response = 
  | { success: true; data: any }
  | { success: false; error: string };
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Rule persistence round trip
*For any* valid rule, saving it to storage and then loading it back should produce an equivalent rule with the same configuration
**Validates: Requirements 9.1, 9.2**

### Property 2: URL pattern validation correctness
*For any* string input, the pattern validation function should correctly identify whether it is a valid regular expression or wildcard pattern
**Validates: Requirements 1.2**

### Property 3: Rule activation state effect
*For any* rule and matching request, the rule should be applied if and only if the rule is in activated state
**Validates: Requirements 1.3, 1.4**

### Property 4: Rule name uniqueness enforcement
*For any* existing rule collection and new rule name, attempting to create a rule with a duplicate name should be rejected
**Validates: Requirements 1.5**

### Property 5: Header modification completeness
*For any* request with header modification rules applied, all specified header operations (set, remove, append) should be present in the modified request
**Validates: Requirements 2.1, 2.3**

### Property 6: Header name validation correctness
*For any* string input, the header name validation should correctly identify whether it follows HTTP specification standards
**Validates: Requirements 2.2**

### Property 7: Rule priority ordering
*For any* set of rules with different priorities matching a single request, the rules should be applied in descending priority order
**Validates: Requirements 2.4**

### Property 8: Security conflict handling
*For any* header modification that conflicts with browser security policies, the modification should be skipped and the conflict should be logged
**Validates: Requirements 2.5**

### Property 9: URL redirection correctness
*For any* request matching a URL redirection rule, the resulting URL should match the specified destination pattern (static or regex-based)
**Validates: Requirements 3.1, 3.2**

### Property 10: URL modification invariant preservation
*For any* request with URL modification applied, the original request method and body should remain unchanged unless explicitly configured otherwise
**Validates: Requirements 3.3**

### Property 11: Invalid URL modification fallback
*For any* URL modification that creates an invalid URL, the original request should proceed unmodified and an error should be logged
**Validates: Requirements 3.4**

### Property 12: Body modification application
*For any* request or response matching a body modification rule, the body content should be replaced or modified according to the rule specification for all supported content types (JSON, text, binary)
**Validates: Requirements 4.1, 4.2**

### Property 13: Body modification content-length consistency
*For any* response with body modification, the Content-Length header should equal the byte length of the modified body
**Validates: Requirements 4.3**

### Property 14: JSON path modification precision
*For any* JSON response and valid JSON path modification, all parts of the JSON structure not targeted by the path should remain unchanged
**Validates: Requirements 4.4**

### Property 15: Request log completeness
*For any* intercepted request, the log entry should contain all required fields (URL, method, headers, timestamp) and list all applied rules with their modifications
**Validates: Requirements 5.1, 5.2**

### Property 16: Log chronological ordering
*For any* set of log entries, when displayed in the log viewer, they should appear in chronological order by timestamp
**Validates: Requirements 5.3**

### Property 17: Log filtering correctness
*For any* log filter criteria and set of log entries, only entries matching all specified filter criteria should be returned
**Validates: Requirements 5.4**

### Property 18: Log retention policy enforcement
*For any* specified log retention period, all log entries older than the period should be automatically deleted
**Validates: Requirements 5.5**

### Property 19: Export completeness
*For any* set of selected rules, the exported JSON file should contain all rules with their complete configurations and metadata (including creation date and last modified date)
**Validates: Requirements 6.1, 6.4**

### Property 20: Import validation and addition
*For any* rules file being imported, the extension should validate the file format, validate all rule patterns and configurations, and add only valid rules to the collection
**Validates: Requirements 6.2, 6.5**

### Property 21: Import duplicate detection
*For any* imported rule with a name that already exists in the collection, the duplicate should be detected before addition
**Validates: Requirements 6.3**

### Property 22: Export-import round trip
*For any* set of rules, exporting them and then importing the export should result in equivalent rules with the same configurations
**Validates: Requirements 6.1, 6.2**

### Property 23: Rule list display completeness
*For any* set of existing rules, when the popup is opened, the data provided to the UI should include all rules with their current status (enabled/disabled)
**Validates: Requirements 7.1**

### Property 24: Rule save validation
*For any* rule being saved (created or edited), all fields should be validated before the rule is persisted to storage
**Validates: Requirements 7.4**

### Property 25: HTTPS request interception
*For any* request using HTTPS protocol, the extension should intercept and modify it according to active rules in the same manner as HTTP requests
**Validates: Requirements 8.1**

### Property 26: HTTPS sensitive data protection
*For any* HTTPS request containing sensitive data, the data should not appear in logs unless the user has explicitly configured logging of sensitive data
**Validates: Requirements 8.3**

### Property 27: HTTPS modification failure logging
*For any* HTTPS request that cannot be modified due to security restrictions, the limitation should be logged
**Validates: Requirements 8.4**

### Property 28: Storage synchronization timing
*For any* rule creation or modification, the change should be persisted to storage within 1 second
**Validates: Requirements 9.4**

### Property 29: Storage failure resilience
*For any* storage operation failure, the error should be logged and the extension should continue operating with in-memory rules
**Validates: Requirements 9.3**

### Property 30: Extension data clear completeness
*For any* extension state, when the user clears extension data, all rules should be removed from storage and the extension should reset to default state
**Validates: Requirements 9.5**

### Property 31: Global pause effectiveness
*For any* request when global pause is active, no rule modifications should be applied regardless of individual rule status, but the request should still be logged as unmodified
**Validates: Requirements 10.1, 10.3**

### Property 32: Global pause state persistence
*For any* global pause state change, the state should be persisted to storage and maintained across extension restarts
**Validates: Requirements 10.4, 10.5**

## Error Handling

### Error Categories

1. **Validation Errors**: Invalid rule configurations, malformed patterns
2. **Storage Errors**: Failed reads/writes to chrome.storage
3. **Permission Errors**: Missing Chrome permissions for certain operations
4. **Network Errors**: Failed request interceptions due to browser limitations
5. **Import/Export Errors**: Invalid file formats, corrupted data

### Error Handling Strategy

```typescript
class ExtensionError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public recoverable: boolean,
    public userMessage: string
  ) {
    super(message);
  }
}

enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  STORAGE_ERROR = 'STORAGE_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  IMPORT_ERROR = 'IMPORT_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

interface ErrorHandler {
  handleError(error: ExtensionError): void;
  logError(error: ExtensionError): void;
  notifyUser(error: ExtensionError): void;
}
```

**Error Handling Rules:**
- All errors should be logged with context
- User-facing errors should have clear, actionable messages
- Recoverable errors should not crash the extension
- Critical errors should disable affected functionality gracefully
- Network errors should allow the original request to proceed

### Specific Error Scenarios

1. **Invalid Rule Pattern**: Validate regex patterns before saving, show error in UI
2. **Storage Quota Exceeded**: Implement log rotation, notify user to clear old logs
3. **Missing Permissions**: Detect at runtime, prompt user to grant permissions
4. **Conflicting Rules**: Warn user, apply priority-based resolution
5. **Import Validation Failure**: Show detailed report of which rules failed and why

## Testing Strategy

### Unit Testing

**Framework**: Jest with TypeScript support

**Test Coverage:**
- Rule Engine: Pattern matching, rule conversion, priority resolution
- Storage Manager: CRUD operations, import/export logic
- Logger: Log entry creation, filtering, retention
- UI Components: User interactions, form validation
- Message Protocol: Request/response handling

**Key Unit Tests:**
- URL pattern matching with various regex patterns
- Header modification operations (set, remove, append)
- JSON path modification logic
- Rule priority sorting
- Storage serialization/deserialization
- Import validation logic

### Property-Based Testing

**Framework**: fast-check (JavaScript/TypeScript property-based testing library)

**Configuration**: Each property test should run a minimum of 100 iterations

**Test Tagging**: Each property-based test must include a comment with the format:
`// Feature: chrome-request-manager, Property {number}: {property_text}`

**Property Test Coverage:**

1. **Rule Persistence Round Trip** (Property 1)
   - Generate random valid rules
   - Save and load each rule
   - Verify equivalence

2. **URL Pattern Matching Consistency** (Property 2)
   - Generate random URLs and patterns
   - Verify deterministic matching

3. **Header Modification Preservation** (Property 3)
   - Generate random header operations
   - Apply to requests
   - Verify all operations present

4. **Rule Priority Ordering** (Property 4)
   - Generate rules with random priorities
   - Verify application order

5. **URL Redirection Correctness** (Property 5)
   - Generate random URLs and redirect rules
   - Verify destination matches pattern

6. **Body Modification Content-Length** (Property 6)
   - Generate random response bodies
   - Modify and verify Content-Length

7. **JSON Path Modification Preservation** (Property 7)
   - Generate random JSON structures
   - Apply path modifications
   - Verify unchanged parts remain identical

8. **Log Entry Completeness** (Property 8)
   - Generate random requests
   - Verify all required log fields present

9. **Export-Import Round Trip** (Property 9)
   - Generate random rule sets
   - Export and import
   - Verify equivalence

10. **Global Pause Effectiveness** (Property 10)
    - Generate random requests with pause active
    - Verify no modifications applied

11. **Rule Activation Immediacy** (Property 11)
    - Activate rule and generate matching request
    - Verify rule applied

12. **Storage Synchronization Timing** (Property 12)
    - Modify rule and measure persistence time
    - Verify within 1 second threshold

### Integration Testing

**Test Scenarios:**
- End-to-end rule creation and application
- UI to service worker communication
- Storage persistence across extension restarts
- Multiple rules interacting on same request
- Import/export workflow

### Manual Testing Checklist

- Test with real websites (HTTP and HTTPS)
- Verify Chrome DevTools integration
- Test with various rule combinations
- Verify performance with many rules
- Test edge cases (very long URLs, large bodies, special characters)

## Performance Considerations

### Optimization Strategies

1. **Use declarativeNetRequest API**: Offload rule evaluation to Chrome's native implementation for better performance
2. **Lazy Loading**: Load logs and rules on-demand in UI
3. **Debouncing**: Debounce storage writes to reduce I/O
4. **Indexing**: Use Map/Set for O(1) rule lookups by ID
5. **Log Rotation**: Automatically prune old logs to prevent storage bloat

### Performance Targets

- Rule evaluation: < 1ms per request
- Storage operations: < 100ms for save/load
- UI responsiveness: < 100ms for user interactions
- Memory usage: < 50MB for typical usage (100 rules, 1000 log entries)
- Extension startup: < 500ms

## Security Considerations

1. **Content Security Policy**: Implement strict CSP for UI pages
2. **Input Validation**: Sanitize all user inputs to prevent injection attacks
3. **Permission Minimization**: Request only necessary Chrome permissions
4. **HTTPS Handling**: Respect browser security policies, don't bypass certificate validation
5. **Data Privacy**: Don't log sensitive data (passwords, tokens) by default
6. **Export Security**: Warn users that exported files may contain sensitive rule configurations

## Future Enhancements

1. **Rule Templates**: Pre-built rules for common scenarios
2. **Collaborative Sharing**: Share rules via cloud sync
3. **Advanced Filtering**: Complex boolean logic for rule conditions
4. **Response Mocking**: Built-in mock server for offline development
5. **Performance Profiling**: Measure impact of rules on page load times
6. **Rule Testing**: Dry-run mode to test rules without applying them
7. **Scripting Support**: Allow JavaScript snippets for dynamic modifications
