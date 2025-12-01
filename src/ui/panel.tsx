import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { LogEntry, LogFilter } from '@/types';
import { UIController } from './UIController';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';

const uiController = new UIController();

interface FilterState {
  urlPattern: string;
  method: string;
  statusCode: string;
  hasModifications: boolean | null;
  dateStart: string;
  dateEnd: string;
}

const LogDetailView: React.FC<{ log: LogEntry; onClose: () => void }> = ({ log, onClose }) => {
  return (
    <div style={styles.detailOverlay} onClick={onClose}>
      <div style={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
        <div style={styles.detailHeader}>
          <h2 style={styles.detailTitle}>Request Details</h2>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>
        
        <div style={styles.detailContent}>
          <section style={styles.detailSection}>
            <h3 style={styles.detailSectionTitle}>General</h3>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>URL:</span>
              <span style={styles.detailValue}>{log.url}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Method:</span>
              <span style={styles.detailValue}>{log.method}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Status:</span>
              <span style={styles.detailValue}>{log.statusCode || 'N/A'}</span>
            </div>
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Timestamp:</span>
              <span style={styles.detailValue}>{new Date(log.timestamp).toLocaleString()}</span>
            </div>
          </section>

          <section style={styles.detailSection}>
            <h3 style={styles.detailSectionTitle}>Request Headers</h3>
            <div style={styles.headersContainer}>
              {Object.entries(log.requestHeaders).length > 0 ? (
                Object.entries(log.requestHeaders).map(([key, value]) => (
                  <div key={key} style={styles.headerRow}>
                    <span style={styles.headerKey}>{key}:</span>
                    <span style={styles.headerValue}>{value}</span>
                  </div>
                ))
              ) : (
                <div style={styles.emptyMessage}>No request headers</div>
              )}
            </div>
          </section>

          {log.responseHeaders && (
            <section style={styles.detailSection}>
              <h3 style={styles.detailSectionTitle}>Response Headers</h3>
              <div style={styles.headersContainer}>
                {Object.entries(log.responseHeaders).length > 0 ? (
                  Object.entries(log.responseHeaders).map(([key, value]) => (
                    <div key={key} style={styles.headerRow}>
                      <span style={styles.headerKey}>{key}:</span>
                      <span style={styles.headerValue}>{value}</span>
                    </div>
                  ))
                ) : (
                  <div style={styles.emptyMessage}>No response headers</div>
                )}
              </div>
            </section>
          )}

          {log.appliedRules.length > 0 && (
            <section style={styles.detailSection}>
              <h3 style={styles.detailSectionTitle}>Applied Rules</h3>
              <div style={styles.rulesContainer}>
                {log.appliedRules.map((ruleId, index) => (
                  <div key={index} style={styles.ruleChip}>
                    {ruleId}
                  </div>
                ))}
              </div>
            </section>
          )}

          {log.modifications.length > 0 && (
            <section style={styles.detailSection}>
              <h3 style={styles.detailSectionTitle}>Modifications</h3>
              <div style={styles.modificationsContainer}>
                {log.modifications.map((mod, index) => (
                  <div key={index} style={styles.modificationItem}>
                    <span style={styles.modificationHighlight}>•</span> {mod}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

const FilterPanel: React.FC<{
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClear: () => void;
}> = ({ filters, onFilterChange, onClear }) => {
  const handleChange = (field: keyof FilterState, value: any) => {
    onFilterChange({ ...filters, [field]: value });
  };

  return (
    <div style={styles.filterPanel}>
      <div style={styles.filterRow}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>URL Pattern:</label>
          <input
            type="text"
            value={filters.urlPattern}
            onChange={(e) => handleChange('urlPattern', e.target.value)}
            placeholder="e.g., api.example.com"
            style={styles.filterInput}
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Method:</label>
          <select
            value={filters.method}
            onChange={(e) => handleChange('method', e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">All</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
            <option value="OPTIONS">OPTIONS</option>
          </select>
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Status Code:</label>
          <input
            type="text"
            value={filters.statusCode}
            onChange={(e) => handleChange('statusCode', e.target.value)}
            placeholder="e.g., 200"
            style={styles.filterInput}
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Modifications:</label>
          <select
            value={filters.hasModifications === null ? '' : filters.hasModifications.toString()}
            onChange={(e) => handleChange('hasModifications', e.target.value === '' ? null : e.target.value === 'true')}
            style={styles.filterSelect}
          >
            <option value="">All</option>
            <option value="true">Modified</option>
            <option value="false">Unmodified</option>
          </select>
        </div>
      </div>

      <div style={styles.filterRow}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Date From:</label>
          <input
            type="datetime-local"
            value={filters.dateStart}
            onChange={(e) => handleChange('dateStart', e.target.value)}
            style={styles.filterInput}
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Date To:</label>
          <input
            type="datetime-local"
            value={filters.dateEnd}
            onChange={(e) => handleChange('dateEnd', e.target.value)}
            style={styles.filterInput}
          />
        </div>

        <div style={styles.filterGroup}>
          <button onClick={onClear} style={styles.clearButton}>
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  );
};

const LogTable: React.FC<{
  logs: LogEntry[];
  onSelectLog: (log: LogEntry) => void;
}> = ({ logs, onSelectLog }) => {
  if (logs.length === 0) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyStateIcon}>📋</div>
        <div style={styles.emptyStateText}>No logs found</div>
        <div style={styles.emptyStateSubtext}>
          Requests will appear here as they are intercepted
        </div>
      </div>
    );
  }

  return (
    <div style={styles.tableContainer}>
      <table style={styles.table}>
        <thead>
          <tr style={styles.tableHeaderRow}>
            <th style={styles.tableHeader}>Time</th>
            <th style={styles.tableHeader}>Method</th>
            <th style={styles.tableHeader}>URL</th>
            <th style={styles.tableHeader}>Status</th>
            <th style={styles.tableHeader}>Rules</th>
            <th style={styles.tableHeader}>Modifications</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              style={styles.tableRow}
              onClick={() => onSelectLog(log)}
            >
              <td style={styles.tableCell}>
                {new Date(log.timestamp).toLocaleTimeString()}
              </td>
              <td style={styles.tableCell}>
                <span style={{
                  ...styles.methodBadge,
                  backgroundColor: getMethodColor(log.method),
                }}>
                  {log.method}
                </span>
              </td>
              <td style={styles.tableCellUrl}>{log.url}</td>
              <td style={styles.tableCell}>
                {log.statusCode ? (
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: getStatusColor(log.statusCode),
                  }}>
                    {log.statusCode}
                  </span>
                ) : (
                  <span style={styles.naText}>-</span>
                )}
              </td>
              <td style={styles.tableCell}>
                {log.appliedRules.length > 0 ? (
                  <span style={styles.ruleCount}>{log.appliedRules.length}</span>
                ) : (
                  <span style={styles.naText}>-</span>
                )}
              </td>
              <td style={styles.tableCell}>
                {log.modifications.length > 0 ? (
                  <span style={styles.modificationIndicator}>
                    ✓ {log.modifications.length}
                  </span>
                ) : (
                  <span style={styles.naText}>-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Panel: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    urlPattern: '',
    method: '',
    statusCode: '',
    hasModifications: null,
    dateStart: '',
    dateEnd: '',
  });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filter: LogFilter = {};
      if (filters.urlPattern) filter.urlPattern = filters.urlPattern;
      if (filters.method) filter.method = filters.method;
      if (filters.statusCode) filter.statusCode = parseInt(filters.statusCode);
      if (filters.hasModifications !== null) filter.hasModifications = filters.hasModifications;
      if (filters.dateStart || filters.dateEnd) {
        filter.dateRange = {
          start: filters.dateStart ? new Date(filters.dateStart) : new Date(0),
          end: filters.dateEnd ? new Date(filters.dateEnd) : new Date(),
        };
      }

      const result = await uiController.getLogs(filter);
      setLogs(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Refresh logs every 2 seconds
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [filters]);

  const handleClearFilters = () => {
    setFilters({
      urlPattern: '',
      method: '',
      statusCode: '',
      hasModifications: null,
      dateStart: '',
      dateEnd: '',
    });
  };

  const handleClearLogs = async () => {
    if (confirm('Are you sure you want to clear all logs?')) {
      try {
        await uiController.clearLogs();
        setLogs([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to clear logs');
      }
    }
  };

  const handleExportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `request-logs-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Request Manager - Advanced Log Viewer</h1>
          <div style={styles.logCount}>
            {logs.length} {logs.length === 1 ? 'log' : 'logs'}
          </div>
        </div>
        <div style={styles.headerRight}>
          <button onClick={fetchLogs} style={styles.refreshButton} disabled={loading}>
            {loading ? '⟳ Loading...' : '⟳ Refresh'}
          </button>
          <button onClick={handleExportLogs} style={styles.exportButton} disabled={logs.length === 0}>
            ⬇ Export
          </button>
          <button onClick={handleClearLogs} style={styles.clearLogsButton} disabled={logs.length === 0}>
            🗑 Clear All
          </button>
        </div>
      </header>

      <FilterPanel
        filters={filters}
        onFilterChange={setFilters}
        onClear={handleClearFilters}
      />

      {error && (
        <div style={styles.errorBanner}>
          <span style={styles.errorIcon}>⚠</span>
          {error}
        </div>
      )}

      <main style={styles.main}>
        <LogTable logs={logs} onSelectLog={setSelectedLog} />
      </main>

      {selectedLog && (
        <LogDetailView log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}
    </div>
  );
};

// Helper functions
function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: '#2196F3',
    POST: '#4CAF50',
    PUT: '#FF9800',
    DELETE: '#F44336',
    PATCH: '#9C27B0',
    OPTIONS: '#607D8B',
  };
  return colors[method] || '#757575';
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return '#4CAF50';
  if (status >= 300 && status < 400) return '#2196F3';
  if (status >= 400 && status < 500) return '#FF9800';
  if (status >= 500) return '#F44336';
  return '#757575';
}

// Styles
const styles = {
  container: {
    width: '100%',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#ffffff',
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f5f5f5',
  } as React.CSSProperties,
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  } as React.CSSProperties,
  headerRight: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#333',
  } as React.CSSProperties,
  logCount: {
    padding: '4px 12px',
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
  } as React.CSSProperties,
  refreshButton: {
    padding: '8px 16px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    backgroundColor: '#fff',
    fontSize: '13px',
    color: '#333',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  exportButton: {
    padding: '8px 16px',
    border: '1px solid #2196F3',
    borderRadius: '4px',
    backgroundColor: '#2196F3',
    fontSize: '13px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  clearLogsButton: {
    padding: '8px 16px',
    border: '1px solid #F44336',
    borderRadius: '4px',
    backgroundColor: '#F44336',
    fontSize: '13px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  filterPanel: {
    padding: '16px 24px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#fafafa',
  } as React.CSSProperties,
  filterRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '12px',
  } as React.CSSProperties,
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  } as React.CSSProperties,
  filterLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#666',
  } as React.CSSProperties,
  filterInput: {
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '13px',
    backgroundColor: '#fff',
  } as React.CSSProperties,
  filterSelect: {
    padding: '8px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    fontSize: '13px',
    backgroundColor: '#fff',
    cursor: 'pointer',
  } as React.CSSProperties,
  clearButton: {
    padding: '8px 16px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    backgroundColor: '#fff',
    fontSize: '13px',
    color: '#666',
    cursor: 'pointer',
    marginTop: '20px',
  } as React.CSSProperties,
  errorBanner: {
    padding: '12px 24px',
    backgroundColor: '#ffebee',
    color: '#c62828',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,
  errorIcon: {
    fontSize: '16px',
  } as React.CSSProperties,
  main: {
    flex: 1,
    overflow: 'auto',
  } as React.CSSProperties,
  tableContainer: {
    width: '100%',
    overflowX: 'auto',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  } as React.CSSProperties,
  tableHeaderRow: {
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #e0e0e0',
  } as React.CSSProperties,
  tableHeader: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
  } as React.CSSProperties,
  tableRow: {
    borderBottom: '1px solid #e0e0e0',
    cursor: 'pointer',
    transition: 'background-color 0.1s',
  } as React.CSSProperties,
  tableCell: {
    padding: '12px 16px',
    fontSize: '13px',
    color: '#333',
  } as React.CSSProperties,
  tableCellUrl: {
    padding: '12px 16px',
    fontSize: '13px',
    color: '#333',
    maxWidth: '400px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  methodBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
  } as React.CSSProperties,
  statusBadge: {
    display: 'inline-block',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
  } as React.CSSProperties,
  ruleCount: {
    color: '#4CAF50',
    fontWeight: 500,
  } as React.CSSProperties,
  modificationIndicator: {
    color: '#2196F3',
    fontWeight: 500,
  } as React.CSSProperties,
  naText: {
    color: '#999',
  } as React.CSSProperties,
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    color: '#999',
  } as React.CSSProperties,
  emptyStateIcon: {
    fontSize: '64px',
    marginBottom: '16px',
  } as React.CSSProperties,
  emptyStateText: {
    fontSize: '18px',
    fontWeight: 500,
    marginBottom: '8px',
  } as React.CSSProperties,
  emptyStateSubtext: {
    fontSize: '14px',
  } as React.CSSProperties,
  detailOverlay: {
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
  detailPanel: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
  } as React.CSSProperties,
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #e0e0e0',
  } as React.CSSProperties,
  detailTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#333',
  } as React.CSSProperties,
  closeButton: {
    padding: '8px 12px',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#f5f5f5',
    fontSize: '18px',
    color: '#666',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  detailContent: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
  } as React.CSSProperties,
  detailSection: {
    marginBottom: '24px',
  } as React.CSSProperties,
  detailSectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#666',
    textTransform: 'uppercase',
  } as React.CSSProperties,
  detailRow: {
    display: 'flex',
    padding: '8px 0',
    borderBottom: '1px solid #f5f5f5',
  } as React.CSSProperties,
  detailLabel: {
    minWidth: '120px',
    fontWeight: 500,
    color: '#666',
    fontSize: '13px',
  } as React.CSSProperties,
  detailValue: {
    flex: 1,
    color: '#333',
    fontSize: '13px',
    wordBreak: 'break-all',
  } as React.CSSProperties,
  headersContainer: {
    backgroundColor: '#fafafa',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    padding: '12px',
    maxHeight: '300px',
    overflowY: 'auto',
  } as React.CSSProperties,
  headerRow: {
    display: 'flex',
    padding: '6px 0',
    fontSize: '12px',
    fontFamily: 'monospace',
  } as React.CSSProperties,
  headerKey: {
    minWidth: '200px',
    fontWeight: 600,
    color: '#666',
  } as React.CSSProperties,
  headerValue: {
    flex: 1,
    color: '#333',
    wordBreak: 'break-all',
  } as React.CSSProperties,
  rulesContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  } as React.CSSProperties,
  ruleChip: {
    padding: '6px 12px',
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    borderRadius: '16px',
    fontSize: '12px',
    fontWeight: 500,
  } as React.CSSProperties,
  modificationsContainer: {
    backgroundColor: '#f5f5f5',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    padding: '12px',
  } as React.CSSProperties,
  modificationItem: {
    padding: '6px 0',
    fontSize: '13px',
    color: '#333',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  } as React.CSSProperties,
  modificationHighlight: {
    color: '#2196F3',
    fontWeight: 600,
  } as React.CSSProperties,
  emptyMessage: {
    color: '#999',
    fontSize: '13px',
    fontStyle: 'italic',
  } as React.CSSProperties,
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <ToastContainer />
      <Panel />
    </ErrorBoundary>
  );
}
