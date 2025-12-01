import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useRules } from './hooks/useRules';
import { useLogs } from './hooks/useLogs';
import { Rule, LogEntry, LogFilter, ExtensionConfig } from '@/types';
import { formatDate, getMethodColor, getStatusColor } from './utils/formatting';

type TabType = 'rules' | 'logs' | 'settings';

const Options: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('rules');

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Chrome Request Manager</h1>
        <p style={styles.subtitle}>Manage rules, view logs, and configure settings</p>
      </header>
      
      <nav style={styles.tabNav}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'rules' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('rules')}
        >
          Rules
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'logs' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('logs')}
        >
          Logs
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'settings' ? styles.tabActive : {})
          }}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </nav>

      <main style={styles.main}>
        {activeTab === 'rules' && <RulesTab />}
        {activeTab === 'logs' && <LogsTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
};

const RulesTab: React.FC = () => {
  const { rules, loading, error, deleteRule, toggleRule, fetchRules } = useRules();
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showImportResult, setShowImportResult] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; skipped: number; errors: string[] } | null>(null);

  const handleEdit = (rule: Rule) => {
    setSelectedRule(rule);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setSelectedRule(null);
    setIsCreating(true);
  };

  const handleClose = () => {
    setSelectedRule(null);
    setIsCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this rule?')) {
      try {
        await deleteRule(id);
      } catch (err) {
        alert('Failed to delete rule: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }
  };

  const handleExport = async () => {
    try {
      const { uiController } = await import('./UIController');
      const exportData = await uiController.exportData();
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `chrome-request-manager-export-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export rules: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        const { uiController } = await import('./UIController');
        const result = await uiController.importData(data);
        
        setImportResult({
          success: result.importedRules,
          skipped: result.skippedRules,
          errors: result.errors
        });
        setShowImportResult(true);
        
        // Refresh rules list
        await fetchRules();
      } catch (err) {
        alert('Failed to import rules: ' + (err instanceof Error ? err.message : 'Invalid file format'));
      }
    };
    
    input.click();
  };

  if (loading) {
    return (
      <div style={styles.tabContent}>
        <div style={styles.loadingMessage}>Loading rules...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.tabContent}>
        <div style={styles.errorMessage}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div style={styles.tabContent}>
      <div style={styles.tabHeader}>
        <h2 style={styles.tabTitle}>Rules</h2>
        <div style={styles.buttonGroup}>
          <button style={styles.importButton} onClick={handleImport}>
            Import Rules
          </button>
          <button style={styles.exportButton} onClick={handleExport} disabled={rules.length === 0}>
            Export Rules
          </button>
          <button style={styles.createButton} onClick={handleCreate}>
            + Create New Rule
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div style={styles.emptyState}>
          <p>No rules configured yet.</p>
          <p style={styles.emptyStateSubtext}>Click "Create New Rule" to get started.</p>
        </div>
      ) : (
        <div style={styles.rulesTable}>
          <div style={styles.tableHeader}>
            <div style={styles.tableHeaderCell}>Name</div>
            <div style={styles.tableHeaderCell}>URL Pattern</div>
            <div style={styles.tableHeaderCell}>Action</div>
            <div style={styles.tableHeaderCell}>Priority</div>
            <div style={styles.tableHeaderCell}>Status</div>
            <div style={styles.tableHeaderCell}>Actions</div>
          </div>
          {rules.map(rule => (
            <div key={rule.id} style={styles.tableRow}>
              <div style={styles.tableCell}>{rule.name}</div>
              <div style={styles.tableCell}>
                <code style={styles.codeText}>{rule.urlPattern.toString()}</code>
              </div>
              <div style={styles.tableCell}>{rule.action.type}</div>
              <div style={styles.tableCell}>{rule.priority}</div>
              <div style={styles.tableCell}>
                <label style={styles.toggleLabel}>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(e) => toggleRule(rule.id, e.target.checked)}
                    style={styles.toggleInput}
                  />
                  <span style={{
                    ...styles.toggleSwitch,
                    backgroundColor: rule.enabled ? '#4CAF50' : '#ccc',
                  }}>
                    <span style={{
                      ...styles.toggleSlider,
                      transform: rule.enabled ? 'translateX(20px)' : 'translateX(2px)',
                    }} />
                  </span>
                </label>
              </div>
              <div style={styles.tableCell}>
                <button
                  style={styles.actionButton}
                  onClick={() => handleEdit(rule)}
                >
                  Edit
                </button>
                <button
                  style={{ ...styles.actionButton, ...styles.deleteButton }}
                  onClick={() => handleDelete(rule.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(selectedRule || isCreating) && (
        <RuleEditorModal
          rule={selectedRule}
          onClose={handleClose}
        />
      )}

      {showImportResult && importResult && (
        <ImportResultModal
          result={importResult}
          onClose={() => setShowImportResult(false)}
        />
      )}
    </div>
  );
};

const RuleEditorModal: React.FC<{ rule: Rule | null; onClose: () => void }> = ({ rule, onClose }) => {
  const { createRule, updateRule } = useRules();
  const [formData, setFormData] = useState({
    name: rule?.name || '',
    urlPattern: rule?.urlPattern.toString() || '',
    priority: rule?.priority || 1,
    enabled: rule?.enabled ?? true,
    actionType: rule?.action.type || 'modifyHeaders' as const,
  });

  const [headerOps, setHeaderOps] = useState<HeaderOperation[]>(
    rule?.action.type === 'modifyHeaders' ? (rule.action.requestHeaders || []) : []
  );

  const [redirectData, setRedirectData] = useState({
    destination: rule?.action.type === 'redirect' ? rule.action.destination : '',
    regexSubstitution: rule?.action.type === 'redirect' ? (rule.action.regexSubstitution || '') : '',
  });

  const [bodyModData, setBodyModData] = useState({
    target: rule?.action.type === 'modifyBody' ? rule.action.target : 'request' as const,
    contentType: rule?.action.type === 'modifyBody' ? rule.action.contentType : 'json' as const,
    modificationType: rule?.action.type === 'modifyBody' ? rule.action.modification.type : 'replace' as const,
    jsonPath: rule?.action.type === 'modifyBody' && rule.action.modification.type === 'jsonPath' ? rule.action.modification.path : '',
    jsonValue: rule?.action.type === 'modifyBody' && rule.action.modification.type === 'jsonPath' ? JSON.stringify(rule.action.modification.value) : '',
    replaceContent: rule?.action.type === 'modifyBody' && rule.action.modification.type === 'replace' ? rule.action.modification.content.toString() : '',
  });

  const [mockData, setMockData] = useState({
    statusCode: rule?.action.type === 'mockResponse' ? rule.action.statusCode : 200,
    headers: rule?.action.type === 'mockResponse' ? JSON.stringify(rule.action.headers, null, 2) : '{}',
    body: rule?.action.type === 'mockResponse' ? rule.action.body : '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.urlPattern.trim()) {
      newErrors.urlPattern = 'URL pattern is required';
    } else {
      try {
        new RegExp(formData.urlPattern);
      } catch {
        newErrors.urlPattern = 'Invalid regular expression';
      }
    }

    if (formData.priority < 1) {
      newErrors.priority = 'Priority must be at least 1';
    }

    if (formData.actionType === 'modifyHeaders') {
      headerOps.forEach((op, idx) => {
        if (!op.header.trim()) {
          newErrors[`header_${idx}`] = 'Header name is required';
        }
        if (op.operation !== 'remove' && !op.value) {
          newErrors[`headerValue_${idx}`] = 'Header value is required';
        }
      });
    }

    if (formData.actionType === 'redirect') {
      if (!redirectData.destination.trim()) {
        newErrors.destination = 'Destination URL is required';
      }
    }

    if (formData.actionType === 'modifyBody') {
      if (bodyModData.modificationType === 'jsonPath') {
        if (!bodyModData.jsonPath.trim()) {
          newErrors.jsonPath = 'JSON path is required';
        }
        if (!bodyModData.jsonValue.trim()) {
          newErrors.jsonValue = 'JSON value is required';
        } else {
          try {
            JSON.parse(bodyModData.jsonValue);
          } catch {
            newErrors.jsonValue = 'Invalid JSON';
          }
        }
      } else {
        if (!bodyModData.replaceContent.trim()) {
          newErrors.replaceContent = 'Content is required';
        }
      }
    }

    if (formData.actionType === 'mockResponse') {
      if (mockData.statusCode < 100 || mockData.statusCode > 599) {
        newErrors.statusCode = 'Status code must be between 100 and 599';
      }
      try {
        JSON.parse(mockData.headers);
      } catch {
        newErrors.headers = 'Invalid JSON';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      let action: RuleAction;

      switch (formData.actionType) {
        case 'modifyHeaders':
          action = {
            type: 'modifyHeaders',
            requestHeaders: headerOps,
          };
          break;
        case 'redirect':
          action = {
            type: 'redirect',
            destination: redirectData.destination,
            regexSubstitution: redirectData.regexSubstitution || undefined,
          };
          break;
        case 'modifyBody':
          action = {
            type: 'modifyBody',
            target: bodyModData.target,
            contentType: bodyModData.contentType,
            modification: bodyModData.modificationType === 'jsonPath'
              ? {
                  type: 'jsonPath',
                  path: bodyModData.jsonPath,
                  value: JSON.parse(bodyModData.jsonValue),
                }
              : {
                  type: 'replace',
                  content: bodyModData.replaceContent,
                },
          };
          break;
        case 'mockResponse':
          action = {
            type: 'mockResponse',
            statusCode: mockData.statusCode,
            headers: JSON.parse(mockData.headers),
            body: mockData.body,
          };
          break;
      }

      const ruleData = {
        name: formData.name,
        urlPattern: formData.urlPattern,
        priority: formData.priority,
        enabled: formData.enabled,
        action,
      };

      if (rule) {
        await updateRule(rule.id, ruleData);
      } else {
        await createRule(ruleData);
      }

      onClose();
    } catch (err) {
      alert('Failed to save rule: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const addHeaderOp = () => {
    setHeaderOps([...headerOps, { operation: 'set', header: '', value: '' }]);
  };

  const removeHeaderOp = (index: number) => {
    setHeaderOps(headerOps.filter((_, i) => i !== index));
  };

  const updateHeaderOp = (index: number, field: keyof HeaderOperation, value: any) => {
    const newOps = [...headerOps];
    newOps[index] = { ...newOps[index], [field]: value };
    setHeaderOps(newOps);
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>{rule ? 'Edit Rule' : 'Create New Rule'}</h3>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Rule Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              style={errors.name ? { ...styles.input, ...styles.inputError } : styles.input}
              placeholder="e.g., Add Auth Header"
            />
            {errors.name && <div style={styles.errorText}>{errors.name}</div>}
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>URL Pattern (RegEx) *</label>
            <input
              type="text"
              value={formData.urlPattern}
              onChange={(e) => setFormData({ ...formData, urlPattern: e.target.value })}
              style={errors.urlPattern ? { ...styles.input, ...styles.inputError } : styles.input}
              placeholder="e.g., https://api\\.example\\.com/.*"
            />
            {errors.urlPattern && <div style={styles.errorText}>{errors.urlPattern}</div>}
          </div>

          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Priority *</label>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                style={errors.priority ? { ...styles.input, ...styles.inputError } : styles.input}
                min="1"
              />
              {errors.priority && <div style={styles.errorText}>{errors.priority}</div>}
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Action Type *</label>
              <select
                value={formData.actionType}
                onChange={(e) => setFormData({ ...formData, actionType: e.target.value as any })}
                style={styles.select}
              >
                <option value="modifyHeaders">Modify Headers</option>
                <option value="redirect">URL Redirection</option>
                <option value="modifyBody">Modify Body</option>
                <option value="mockResponse">Mock Response</option>
              </select>
            </div>
          </div>

          {formData.actionType === 'modifyHeaders' && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Header Operations</label>
              {headerOps.map((op, idx) => (
                <div key={idx} style={styles.headerOpRow}>
                  <select
                    value={op.operation}
                    onChange={(e) => updateHeaderOp(idx, 'operation', e.target.value)}
                    style={styles.selectSmall}
                  >
                    <option value="set">Set</option>
                    <option value="remove">Remove</option>
                    <option value="append">Append</option>
                  </select>
                  <input
                    type="text"
                    value={op.header}
                    onChange={(e) => updateHeaderOp(idx, 'header', e.target.value)}
                    placeholder="Header name"
                    style={errors[`header_${idx}`] ? { ...styles.inputSmall, ...styles.inputError } : styles.inputSmall}
                  />
                  {op.operation !== 'remove' && (
                    <input
                      type="text"
                      value={op.value || ''}
                      onChange={(e) => updateHeaderOp(idx, 'value', e.target.value)}
                      placeholder="Header value"
                      style={errors[`headerValue_${idx}`] ? { ...styles.inputSmall, ...styles.inputError } : styles.inputSmall}
                    />
                  )}
                  <button
                    onClick={() => removeHeaderOp(idx)}
                    style={styles.removeButton}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button onClick={addHeaderOp} style={styles.addButton}>
                + Add Header Operation
              </button>
            </div>
          )}

          {formData.actionType === 'redirect' && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>Destination URL *</label>
                <input
                  type="text"
                  value={redirectData.destination}
                  onChange={(e) => setRedirectData({ ...redirectData, destination: e.target.value })}
                  style={errors.destination ? { ...styles.input, ...styles.inputError } : styles.input}
                  placeholder="https://example.com/api"
                />
                {errors.destination && <div style={styles.errorText}>{errors.destination}</div>}
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Regex Substitution (optional)</label>
                <input
                  type="text"
                  value={redirectData.regexSubstitution}
                  onChange={(e) => setRedirectData({ ...redirectData, regexSubstitution: e.target.value })}
                  style={styles.input}
                  placeholder="$1/new-path/$2"
                />
              </div>
            </>
          )}

          {formData.actionType === 'modifyBody' && (
            <>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Target</label>
                  <select
                    value={bodyModData.target}
                    onChange={(e) => setBodyModData({ ...bodyModData, target: e.target.value as any })}
                    style={styles.select}
                  >
                    <option value="request">Request</option>
                    <option value="response">Response</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Content Type</label>
                  <select
                    value={bodyModData.contentType}
                    onChange={(e) => setBodyModData({ ...bodyModData, contentType: e.target.value as any })}
                    style={styles.select}
                  >
                    <option value="json">JSON</option>
                    <option value="text">Text</option>
                    <option value="binary">Binary</option>
                  </select>
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Modification Type</label>
                <select
                  value={bodyModData.modificationType}
                  onChange={(e) => setBodyModData({ ...bodyModData, modificationType: e.target.value as any })}
                  style={styles.select}
                >
                  <option value="jsonPath">JSON Path</option>
                  <option value="replace">Full Replace</option>
                </select>
              </div>
              {bodyModData.modificationType === 'jsonPath' ? (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>JSON Path *</label>
                    <input
                      type="text"
                      value={bodyModData.jsonPath}
                      onChange={(e) => setBodyModData({ ...bodyModData, jsonPath: e.target.value })}
                      style={errors.jsonPath ? { ...styles.input, ...styles.inputError } : styles.input}
                      placeholder="user.name"
                    />
                    {errors.jsonPath && <div style={styles.errorText}>{errors.jsonPath}</div>}
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Value (JSON) *</label>
                    <textarea
                      value={bodyModData.jsonValue}
                      onChange={(e) => setBodyModData({ ...bodyModData, jsonValue: e.target.value })}
                      style={errors.jsonValue ? { ...styles.textarea, ...styles.inputError } : styles.textarea}
                      placeholder='"new value"'
                      rows={3}
                    />
                    {errors.jsonValue && <div style={styles.errorText}>{errors.jsonValue}</div>}
                  </div>
                </>
              ) : (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Content *</label>
                  <textarea
                    value={bodyModData.replaceContent}
                    onChange={(e) => setBodyModData({ ...bodyModData, replaceContent: e.target.value })}
                    style={errors.replaceContent ? { ...styles.textarea, ...styles.inputError } : styles.textarea}
                    placeholder="New body content"
                    rows={5}
                  />
                  {errors.replaceContent && <div style={styles.errorText}>{errors.replaceContent}</div>}
                </div>
              )}
            </>
          )}

          {formData.actionType === 'mockResponse' && (
            <>
              <div style={styles.formGroup}>
                <label style={styles.label}>Status Code *</label>
                <input
                  type="number"
                  value={mockData.statusCode}
                  onChange={(e) => setMockData({ ...mockData, statusCode: parseInt(e.target.value) || 200 })}
                  style={errors.statusCode ? { ...styles.input, ...styles.inputError } : styles.input}
                  min="100"
                  max="599"
                />
                {errors.statusCode && <div style={styles.errorText}>{errors.statusCode}</div>}
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Headers (JSON) *</label>
                <textarea
                  value={mockData.headers}
                  onChange={(e) => setMockData({ ...mockData, headers: e.target.value })}
                  style={errors.headers ? { ...styles.textarea, ...styles.inputError } : styles.textarea}
                  placeholder='{"Content-Type": "application/json"}'
                  rows={3}
                />
                {errors.headers && <div style={styles.errorText}>{errors.headers}</div>}
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Body</label>
                <textarea
                  value={mockData.body}
                  onChange={(e) => setMockData({ ...mockData, body: e.target.value })}
                  style={styles.textarea}
                  placeholder="Response body"
                  rows={5}
                />
              </div>
            </>
          )}

          <div style={styles.modalFooter}>
            <button onClick={onClose} style={styles.cancelButton} disabled={saving}>
              Cancel
            </button>
            <button onClick={handleSave} style={styles.saveButton} disabled={saving}>
              {saving ? 'Saving...' : 'Save Rule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ImportResultModal: React.FC<{ 
  result: { success: number; skipped: number; errors: string[] }; 
  onClose: () => void 
}> = ({ result, onClose }) => {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Import Results</h3>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.importResultSection}>
            <div style={styles.importResultRow}>
              <span style={styles.importResultLabel}>Successfully Imported:</span>
              <span style={styles.importResultSuccess}>{result.success} rule(s)</span>
            </div>
            <div style={styles.importResultRow}>
              <span style={styles.importResultLabel}>Skipped (duplicates):</span>
              <span style={styles.importResultSkipped}>{result.skipped} rule(s)</span>
            </div>
            {result.errors.length > 0 && (
              <div style={styles.importResultErrors}>
                <h4 style={styles.importResultErrorTitle}>Errors:</h4>
                <ul style={styles.importResultErrorList}>
                  {result.errors.map((error, idx) => (
                    <li key={idx} style={styles.importResultErrorItem}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div style={styles.modalFooter}>
            <button onClick={onClose} style={styles.saveButton}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LogsTab: React.FC = () => {
  const { logs, loading, error, fetchLogs, clearLogs } = useLogs();
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [filter, setFilter] = useState<LogFilter>({});
  const [filterForm, setFilterForm] = useState({
    urlPattern: '',
    method: '',
    statusCode: '',
    dateStart: '',
    dateEnd: '',
  });

  React.useEffect(() => {
    fetchLogs(filter);
  }, [filter, fetchLogs]);

  const handleApplyFilter = () => {
    const newFilter: LogFilter = {};
    if (filterForm.urlPattern) newFilter.urlPattern = filterForm.urlPattern;
    if (filterForm.method) newFilter.method = filterForm.method;
    if (filterForm.statusCode) newFilter.statusCode = parseInt(filterForm.statusCode);
    if (filterForm.dateStart || filterForm.dateEnd) {
      newFilter.dateRange = {
        start: filterForm.dateStart ? new Date(filterForm.dateStart) : new Date(0),
        end: filterForm.dateEnd ? new Date(filterForm.dateEnd) : new Date(),
      };
    }
    setFilter(newFilter);
  };

  const handleClearFilter = () => {
    setFilterForm({
      urlPattern: '',
      method: '',
      statusCode: '',
      dateStart: '',
      dateEnd: '',
    });
    setFilter({});
  };

  const handleClearLogs = async () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      try {
        await clearLogs();
      } catch (err) {
        alert('Failed to clear logs: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }
  };

  const handleExportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading && logs.length === 0) {
    return (
      <div style={styles.tabContent}>
        <div style={styles.loadingMessage}>Loading logs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.tabContent}>
        <div style={styles.errorMessage}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div style={styles.tabContent}>
      <div style={styles.tabHeader}>
        <h2 style={styles.tabTitle}>Logs</h2>
        <div style={styles.buttonGroup}>
          <button style={styles.exportButton} onClick={handleExportLogs} disabled={logs.length === 0}>
            Export Logs
          </button>
          <button style={styles.clearLogsButton} onClick={handleClearLogs} disabled={logs.length === 0}>
            Clear Logs
          </button>
        </div>
      </div>

      <div style={styles.filterSection}>
        <h3 style={styles.filterTitle}>Filters</h3>
        <div style={styles.filterGrid}>
          <div style={styles.formGroup}>
            <label style={styles.label}>URL Pattern</label>
            <input
              type="text"
              value={filterForm.urlPattern}
              onChange={(e) => setFilterForm({ ...filterForm, urlPattern: e.target.value })}
              style={styles.input}
              placeholder="e.g., api.example.com"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Method</label>
            <select
              value={filterForm.method}
              onChange={(e) => setFilterForm({ ...filterForm, method: e.target.value })}
              style={styles.select}
            >
              <option value="">All</option>
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
              <option value="PATCH">PATCH</option>
              <option value="HEAD">HEAD</option>
              <option value="OPTIONS">OPTIONS</option>
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Status Code</label>
            <input
              type="number"
              value={filterForm.statusCode}
              onChange={(e) => setFilterForm({ ...filterForm, statusCode: e.target.value })}
              style={styles.input}
              placeholder="e.g., 200"
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Date Start</label>
            <input
              type="datetime-local"
              value={filterForm.dateStart}
              onChange={(e) => setFilterForm({ ...filterForm, dateStart: e.target.value })}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Date End</label>
            <input
              type="datetime-local"
              value={filterForm.dateEnd}
              onChange={(e) => setFilterForm({ ...filterForm, dateEnd: e.target.value })}
              style={styles.input}
            />
          </div>
        </div>
        <div style={styles.filterActions}>
          <button style={styles.filterButton} onClick={handleApplyFilter}>
            Apply Filters
          </button>
          <button style={styles.clearFilterButton} onClick={handleClearFilter}>
            Clear Filters
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div style={styles.emptyState}>
          <p>No logs found</p>
          <p style={styles.emptyStateSubtext}>Logs will appear here as requests are intercepted</p>
        </div>
      ) : (
        <div style={styles.logsTable}>
          <div style={styles.logsTableHeader}>
            <div style={styles.logsTableHeaderCell}>Timestamp</div>
            <div style={styles.logsTableHeaderCell}>Method</div>
            <div style={styles.logsTableHeaderCell}>URL</div>
            <div style={styles.logsTableHeaderCell}>Status</div>
            <div style={styles.logsTableHeaderCell}>Rules Applied</div>
            <div style={styles.logsTableHeaderCell}>Actions</div>
          </div>
          {logs.map(log => (
            <div key={log.id} style={styles.logsTableRow}>
              <div style={styles.logsTableCell}>{formatDate(log.timestamp)}</div>
              <div style={styles.logsTableCell}>
                <span style={{ ...styles.methodBadge, backgroundColor: getMethodColor(log.method) }}>
                  {log.method}
                </span>
              </div>
              <div style={styles.logsTableCell}>
                <div style={styles.urlText}>{log.url}</div>
              </div>
              <div style={styles.logsTableCell}>
                {log.statusCode && (
                  <span style={{ ...styles.statusBadge, color: getStatusColor(log.statusCode) }}>
                    {log.statusCode}
                  </span>
                )}
              </div>
              <div style={styles.logsTableCell}>
                {log.appliedRules.length > 0 ? (
                  <span style={styles.rulesBadge}>{log.appliedRules.length} rule(s)</span>
                ) : (
                  <span style={styles.noRulesBadge}>None</span>
                )}
              </div>
              <div style={styles.logsTableCell}>
                <button
                  style={styles.viewButton}
                  onClick={() => setSelectedLog(log)}
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
};

const LogDetailModal: React.FC<{ log: LogEntry; onClose: () => void }> = ({ log, onClose }) => {
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Log Details</h3>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.logDetailSection}>
            <h4 style={styles.logDetailTitle}>Request Information</h4>
            <div style={styles.logDetailRow}>
              <span style={styles.logDetailLabel}>Timestamp:</span>
              <span>{formatDate(log.timestamp)}</span>
            </div>
            <div style={styles.logDetailRow}>
              <span style={styles.logDetailLabel}>Method:</span>
              <span style={{ ...styles.methodBadge, backgroundColor: getMethodColor(log.method) }}>
                {log.method}
              </span>
            </div>
            <div style={styles.logDetailRow}>
              <span style={styles.logDetailLabel}>URL:</span>
              <span style={styles.urlTextFull}>{log.url}</span>
            </div>
            {log.statusCode && (
              <div style={styles.logDetailRow}>
                <span style={styles.logDetailLabel}>Status Code:</span>
                <span style={{ ...styles.statusBadge, color: getStatusColor(log.statusCode) }}>
                  {log.statusCode}
                </span>
              </div>
            )}
          </div>

          <div style={styles.logDetailSection}>
            <h4 style={styles.logDetailTitle}>Request Headers</h4>
            <pre style={styles.codeBlock}>
              {JSON.stringify(log.requestHeaders, null, 2)}
            </pre>
          </div>

          {log.responseHeaders && (
            <div style={styles.logDetailSection}>
              <h4 style={styles.logDetailTitle}>Response Headers</h4>
              <pre style={styles.codeBlock}>
                {JSON.stringify(log.responseHeaders, null, 2)}
              </pre>
            </div>
          )}

          <div style={styles.logDetailSection}>
            <h4 style={styles.logDetailTitle}>Applied Rules</h4>
            {log.appliedRules.length > 0 ? (
              <ul style={styles.rulesList}>
                {log.appliedRules.map((ruleId, idx) => (
                  <li key={idx} style={styles.rulesListItem}>{ruleId}</li>
                ))}
              </ul>
            ) : (
              <p style={styles.noRulesText}>No rules were applied to this request</p>
            )}
          </div>

          <div style={styles.logDetailSection}>
            <h4 style={styles.logDetailTitle}>Modifications</h4>
            {log.modifications.length > 0 ? (
              <ul style={styles.modificationsList}>
                {log.modifications.map((mod, idx) => (
                  <li key={idx} style={styles.modificationsListItem}>{mod}</li>
                ))}
              </ul>
            ) : (
              <p style={styles.noModsText}>No modifications were made to this request</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const SettingsTab: React.FC = () => {
  const [config, setConfig] = useState<ExtensionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const { uiController } = await import('./UIController');
      const loadedConfig = await uiController.getConfig();
      setConfig(loadedConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setError(null);
    try {
      const { uiController } = await import('./UIController');
      await uiController.updateConfig(config);
      alert('Settings saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
      alert('Failed to save settings: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleClearAllData = async () => {
    if (!confirm('Are you sure you want to clear ALL extension data? This will delete all rules, logs, and reset settings to defaults. This action cannot be undone.')) {
      return;
    }

    if (!confirm('This is your last warning. All data will be permanently deleted. Continue?')) {
      return;
    }

    try {
      const { uiController } = await import('./UIController');
      await uiController.clearAllData();
      alert('All extension data has been cleared');
      // Reload config
      await loadConfig();
    } catch (err) {
      alert('Failed to clear data: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div style={styles.tabContent}>
        <div style={styles.loadingMessage}>Loading settings...</div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div style={styles.tabContent}>
        <div style={styles.errorMessage}>Error: {error}</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={styles.tabContent}>
        <div style={styles.errorMessage}>Failed to load configuration</div>
      </div>
    );
  }

  return (
    <div style={styles.tabContent}>
      <div style={styles.tabHeader}>
        <h2 style={styles.tabTitle}>Settings</h2>
        <button style={styles.saveButton} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {error && <div style={styles.errorMessage}>{error}</div>}

      <div style={styles.settingsSection}>
        <h3 style={styles.settingsSectionTitle}>Logging</h3>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Log Retention Period (days)</label>
          <input
            type="number"
            value={config.logRetentionDays}
            onChange={(e) => setConfig({ ...config, logRetentionDays: parseInt(e.target.value) || 7 })}
            style={styles.input}
            min="1"
            max="365"
          />
          <div style={styles.helpText}>
            Logs older than this will be automatically deleted
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Maximum Log Entries</label>
          <input
            type="number"
            value={config.maxLogEntries}
            onChange={(e) => setConfig({ ...config, maxLogEntries: parseInt(e.target.value) || 1000 })}
            style={styles.input}
            min="100"
            max="10000"
          />
          <div style={styles.helpText}>
            Maximum number of log entries to keep in storage
          </div>
        </div>
      </div>

      <div style={styles.settingsSection}>
        <h3 style={styles.settingsSectionTitle}>Security</h3>
        
        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={config.enableHTTPS}
              onChange={(e) => setConfig({ ...config, enableHTTPS: e.target.checked })}
              style={styles.checkbox}
            />
            <span>Enable HTTPS Interception</span>
          </label>
          <div style={styles.helpText}>
            Allow the extension to intercept and modify HTTPS requests. This requires additional permissions.
          </div>
        </div>
      </div>

      <div style={styles.settingsSection}>
        <h3 style={styles.settingsSectionTitle}>Appearance</h3>
        
        <div style={styles.formGroup}>
          <label style={styles.label}>Theme</label>
          <select
            value={config.theme}
            onChange={(e) => setConfig({ ...config, theme: e.target.value as any })}
            style={styles.select}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto (System)</option>
          </select>
          <div style={styles.helpText}>
            Choose your preferred color theme
          </div>
        </div>
      </div>

      <div style={styles.settingsSection}>
        <h3 style={styles.settingsSectionTitle}>Danger Zone</h3>
        
        <div style={styles.dangerZone}>
          <div>
            <div style={styles.dangerZoneTitle}>Clear All Extension Data</div>
            <div style={styles.dangerZoneText}>
              This will permanently delete all rules, logs, and reset settings to defaults. This action cannot be undone.
            </div>
          </div>
          <button style={styles.dangerButton} onClick={handleClearAllData}>
            Clear All Data
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  } as React.CSSProperties,
  header: {
    padding: '24px 32px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e0e0e0',
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 600,
    color: '#333',
  } as React.CSSProperties,
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: '14px',
    color: '#666',
  } as React.CSSProperties,
  tabNav: {
    display: 'flex',
    gap: '4px',
    padding: '0 32px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e0e0e0',
  } as React.CSSProperties,
  tab: {
    padding: '12px 24px',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '14px',
    fontWeight: 500,
    color: '#666',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  tabActive: {
    color: '#2196F3',
    borderBottomColor: '#2196F3',
  } as React.CSSProperties,
  main: {
    padding: '32px',
  } as React.CSSProperties,
  tabContent: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  } as React.CSSProperties,
  tabHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
  } as React.CSSProperties,
  tabTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#333',
  } as React.CSSProperties,
  createButton: {
    padding: '10px 20px',
    backgroundColor: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  loadingMessage: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
  } as React.CSSProperties,
  errorMessage: {
    textAlign: 'center',
    padding: '40px',
    color: '#d32f2f',
  } as React.CSSProperties,
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#666',
  } as React.CSSProperties,
  emptyStateSubtext: {
    fontSize: '14px',
    color: '#999',
  } as React.CSSProperties,
  rulesTable: {
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
  } as React.CSSProperties,
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: '2fr 3fr 1.5fr 1fr 1fr 2fr',
    backgroundColor: '#f5f5f5',
    padding: '12px 16px',
    fontWeight: 600,
    fontSize: '14px',
    color: '#333',
    borderBottom: '1px solid #e0e0e0',
  } as React.CSSProperties,
  tableHeaderCell: {
    padding: '0 8px',
  } as React.CSSProperties,
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 3fr 1.5fr 1fr 1fr 2fr',
    padding: '12px 16px',
    borderBottom: '1px solid #e0e0e0',
    alignItems: 'center',
  } as React.CSSProperties,
  tableCell: {
    padding: '0 8px',
    fontSize: '14px',
    color: '#333',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  codeText: {
    fontFamily: 'monospace',
    fontSize: '12px',
    backgroundColor: '#f5f5f5',
    padding: '2px 6px',
    borderRadius: '3px',
  } as React.CSSProperties,
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  } as React.CSSProperties,
  toggleInput: {
    display: 'none',
  } as React.CSSProperties,
  toggleSwitch: {
    position: 'relative',
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  toggleSlider: {
    position: 'absolute',
    top: '2px',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    backgroundColor: '#fff',
    transition: 'transform 0.2s',
  } as React.CSSProperties,
  actionButton: {
    padding: '6px 12px',
    marginRight: '8px',
    backgroundColor: '#fff',
    color: '#2196F3',
    border: '1px solid #2196F3',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  deleteButton: {
    color: '#d32f2f',
    borderColor: '#d32f2f',
  } as React.CSSProperties,
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as React.CSSProperties,
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '800px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
  } as React.CSSProperties,
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e0e0e0',
  } as React.CSSProperties,
  modalTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#333',
  } as React.CSSProperties,
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    color: '#666',
    cursor: 'pointer',
    padding: 0,
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  modalBody: {
    padding: '24px',
  } as React.CSSProperties,
  formGroup: {
    marginBottom: '20px',
  } as React.CSSProperties,
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  } as React.CSSProperties,
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  } as React.CSSProperties,
  inputSmall: {
    flex: 1,
    padding: '8px 10px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
  } as React.CSSProperties,
  inputError: {
    borderColor: '#d32f2f',
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
  } as React.CSSProperties,
  selectSmall: {
    padding: '8px 10px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: '#fff',
  } as React.CSSProperties,
  textarea: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'monospace',
    resize: 'vertical',
    boxSizing: 'border-box',
  } as React.CSSProperties,
  errorText: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#d32f2f',
  } as React.CSSProperties,
  headerOpRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
    alignItems: 'center',
  } as React.CSSProperties,
  addButton: {
    padding: '8px 16px',
    backgroundColor: '#fff',
    color: '#2196F3',
    border: '1px solid #2196F3',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  removeButton: {
    padding: '8px 12px',
    backgroundColor: '#fff',
    color: '#d32f2f',
    border: '1px solid #d32f2f',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    marginTop: '24px',
    paddingTop: '24px',
    borderTop: '1px solid #e0e0e0',
  } as React.CSSProperties,
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#fff',
    color: '#666',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  } as React.CSSProperties,
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,
  buttonGroup: {
    display: 'flex',
    gap: '12px',
  } as React.CSSProperties,
  exportButton: {
    padding: '10px 20px',
    backgroundColor: '#4CAF50',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,
  clearLogsButton: {
    padding: '10px 20px',
    backgroundColor: '#d32f2f',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,
  filterSection: {
    marginBottom: '24px',
    padding: '20px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
  } as React.CSSProperties,
  filterTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: 600,
    color: '#333',
  } as React.CSSProperties,
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px',
  } as React.CSSProperties,
  filterActions: {
    display: 'flex',
    gap: '12px',
  } as React.CSSProperties,
  filterButton: {
    padding: '10px 20px',
    backgroundColor: '#2196F3',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,
  clearFilterButton: {
    padding: '10px 20px',
    backgroundColor: '#fff',
    color: '#666',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '14px',
    cursor: 'pointer',
  } as React.CSSProperties,
  logsTable: {
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    overflow: 'hidden',
  } as React.CSSProperties,
  logsTableHeader: {
    display: 'grid',
    gridTemplateColumns: '180px 100px 2fr 100px 120px 120px',
    backgroundColor: '#f5f5f5',
    padding: '12px 16px',
    fontWeight: 600,
    fontSize: '14px',
    color: '#333',
    borderBottom: '1px solid #e0e0e0',
  } as React.CSSProperties,
  logsTableHeaderCell: {
    padding: '0 8px',
  } as React.CSSProperties,
  logsTableRow: {
    display: 'grid',
    gridTemplateColumns: '180px 100px 2fr 100px 120px 120px',
    padding: '12px 16px',
    borderBottom: '1px solid #e0e0e0',
    alignItems: 'center',
  } as React.CSSProperties,
  logsTableCell: {
    padding: '0 8px',
    fontSize: '14px',
    color: '#333',
    overflow: 'hidden',
  } as React.CSSProperties,
  methodBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
  } as React.CSSProperties,
  statusBadge: {
    fontSize: '14px',
    fontWeight: 600,
  } as React.CSSProperties,
  urlText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  urlTextFull: {
    wordBreak: 'break-all',
  } as React.CSSProperties,
  rulesBadge: {
    color: '#4CAF50',
    fontWeight: 500,
  } as React.CSSProperties,
  noRulesBadge: {
    color: '#999',
  } as React.CSSProperties,
  viewButton: {
    padding: '6px 12px',
    backgroundColor: '#fff',
    color: '#2196F3',
    border: '1px solid #2196F3',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
  } as React.CSSProperties,
  logDetailSection: {
    marginBottom: '24px',
  } as React.CSSProperties,
  logDetailTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: 600,
    color: '#333',
  } as React.CSSProperties,
  logDetailRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '8px',
    alignItems: 'center',
  } as React.CSSProperties,
  logDetailLabel: {
    fontWeight: 600,
    minWidth: '120px',
  } as React.CSSProperties,
  codeBlock: {
    backgroundColor: '#f5f5f5',
    padding: '12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    overflow: 'auto',
    maxHeight: '300px',
  } as React.CSSProperties,
  rulesList: {
    margin: 0,
    padding: '0 0 0 20px',
  } as React.CSSProperties,
  rulesListItem: {
    marginBottom: '4px',
    color: '#333',
  } as React.CSSProperties,
  noRulesText: {
    color: '#999',
    fontStyle: 'italic',
  } as React.CSSProperties,
  modificationsList: {
    margin: 0,
    padding: '0 0 0 20px',
  } as React.CSSProperties,
  modificationsListItem: {
    marginBottom: '4px',
    color: '#333',
  } as React.CSSProperties,
  noModsText: {
    color: '#999',
    fontStyle: 'italic',
  } as React.CSSProperties,
  settingsSection: {
    marginBottom: '32px',
    paddingBottom: '32px',
    borderBottom: '1px solid #e0e0e0',
  } as React.CSSProperties,
  settingsSectionTitle: {
    margin: '0 0 20px 0',
    fontSize: '18px',
    fontWeight: 600,
    color: '#333',
  } as React.CSSProperties,
  helpText: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#666',
  } as React.CSSProperties,
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '14px',
  } as React.CSSProperties,
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  } as React.CSSProperties,
  dangerZone: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: '#fff5f5',
    border: '1px solid #ffcdd2',
    borderRadius: '8px',
  } as React.CSSProperties,
  dangerZoneTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#d32f2f',
    marginBottom: '4px',
  } as React.CSSProperties,
  dangerZoneText: {
    fontSize: '14px',
    color: '#666',
  } as React.CSSProperties,
  dangerButton: {
    padding: '10px 20px',
    backgroundColor: '#d32f2f',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  importButton: {
    padding: '10px 20px',
    backgroundColor: '#fff',
    color: '#2196F3',
    border: '1px solid #2196F3',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,
  importResultSection: {
    padding: '20px 0',
  } as React.CSSProperties,
  importResultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid #e0e0e0',
  } as React.CSSProperties,
  importResultLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
  } as React.CSSProperties,
  importResultSuccess: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#4CAF50',
  } as React.CSSProperties,
  importResultSkipped: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#ff9800',
  } as React.CSSProperties,
  importResultErrors: {
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#fff5f5',
    borderRadius: '4px',
    border: '1px solid #ffcdd2',
  } as React.CSSProperties,
  importResultErrorTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#d32f2f',
  } as React.CSSProperties,
  importResultErrorList: {
    margin: 0,
    padding: '0 0 0 20px',
  } as React.CSSProperties,
  importResultErrorItem: {
    marginBottom: '8px',
    fontSize: '13px',
    color: '#d32f2f',
  } as React.CSSProperties,
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Options />);
}
