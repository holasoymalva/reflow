import React from 'react';
import { createRoot } from 'react-dom/client';
import { useRules } from './hooks/useRules';
import { useGlobalPause } from './hooks/useGlobalPause';
import { useLogs } from './hooks/useLogs';
import { Rule } from '@/types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';

const RuleListItem: React.FC<{ rule: Rule; onToggle: (id: string, enabled: boolean) => void }> = ({ rule, onToggle }) => {
  return (
    <div style={styles.ruleItem}>
      <div style={styles.ruleInfo}>
        <div style={styles.ruleName}>{rule.name}</div>
        <div style={styles.rulePattern}>{rule.urlPattern.toString()}</div>
      </div>
      <label style={styles.toggleLabel}>
        <input
          type="checkbox"
          checked={rule.enabled}
          onChange={(e) => onToggle(rule.id, e.target.checked)}
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
      {rule.enabled && <div style={styles.activeIndicator} />}
    </div>
  );
};

const RuleList: React.FC = () => {
  const { rules, loading, error, toggleRule } = useRules();

  if (loading) {
    return <div style={styles.message}>Loading rules...</div>;
  }

  if (error) {
    return <div style={styles.error}>Error: {error}</div>;
  }

  if (rules.length === 0) {
    return <div style={styles.message}>No rules configured. Open options to create rules.</div>;
  }

  return (
    <div style={styles.ruleList}>
      {rules.map(rule => (
        <RuleListItem key={rule.id} rule={rule} onToggle={toggleRule} />
      ))}
    </div>
  );
};

const GlobalPauseButton: React.FC = () => {
  const { isPaused, loading, togglePause } = useGlobalPause();

  const handleClick = () => {
    togglePause(!isPaused);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        ...styles.pauseButton,
        backgroundColor: isPaused ? '#ff9800' : '#4CAF50',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? 'Loading...' : isPaused ? '▶ Resume All Rules' : '⏸ Pause All Rules'}
    </button>
  );
};

const RecentLogs: React.FC = () => {
  const { logs, loading, error, fetchLogs } = useLogs();
  const [initialized, setInitialized] = React.useState(false);

  React.useEffect(() => {
    if (!initialized) {
      fetchLogs();
      setInitialized(true);
    }
  }, [initialized, fetchLogs]);

  const recentLogs = logs.slice(0, 10);

  const openOptionsPage = () => {
    chrome.runtime.openOptionsPage();
  };

  if (loading && !initialized) {
    return <div style={styles.logsSection}>Loading logs...</div>;
  }

  if (error) {
    return <div style={styles.logsSection}>Error loading logs: {error}</div>;
  }

  return (
    <div style={styles.logsSection}>
      <div style={styles.logsSectionHeader}>
        <h2 style={styles.sectionTitle}>Recent Logs</h2>
        <button onClick={openOptionsPage} style={styles.viewAllButton}>
          View All →
        </button>
      </div>
      {recentLogs.length === 0 ? (
        <div style={styles.message}>No logs yet</div>
      ) : (
        <div style={styles.logsList}>
          {recentLogs.map(log => (
            <div key={log.id} style={styles.logItem}>
              <div style={styles.logMethod}>{log.method}</div>
              <div style={styles.logUrl}>{log.url}</div>
              <div style={styles.logMeta}>
                {log.statusCode && <span style={styles.logStatus}>{log.statusCode}</span>}
                {log.appliedRules.length > 0 && (
                  <span style={styles.logRules}>{log.appliedRules.length} rule(s)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Popup: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastContainer />
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Chrome Request Manager</h1>
        </header>
        <main style={styles.main}>
          <ErrorBoundary>
            <GlobalPauseButton />
          </ErrorBoundary>
          <div style={styles.divider} />
          <ErrorBoundary>
            <RuleList />
          </ErrorBoundary>
          <div style={styles.divider} />
          <ErrorBoundary>
            <RecentLogs />
          </ErrorBoundary>
        </main>
      </div>
    </ErrorBoundary>
  );
};

const styles = {
  container: {
    width: '400px',
    minHeight: '500px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#ffffff',
  } as React.CSSProperties,
  header: {
    padding: '16px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f5f5f5',
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#333',
  } as React.CSSProperties,
  main: {
    padding: '16px',
  } as React.CSSProperties,
  ruleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  } as React.CSSProperties,
  ruleItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    backgroundColor: '#fafafa',
    position: 'relative',
  } as React.CSSProperties,
  ruleInfo: {
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,
  ruleName: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
    marginBottom: '4px',
  } as React.CSSProperties,
  rulePattern: {
    fontSize: '12px',
    color: '#666',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    marginLeft: '12px',
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
  activeIndicator: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#4CAF50',
  } as React.CSSProperties,
  message: {
    padding: '20px',
    textAlign: 'center',
    color: '#666',
    fontSize: '14px',
  } as React.CSSProperties,
  error: {
    padding: '20px',
    textAlign: 'center',
    color: '#d32f2f',
    fontSize: '14px',
  } as React.CSSProperties,
  pauseButton: {
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    borderRadius: '4px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  } as React.CSSProperties,
  divider: {
    height: '1px',
    backgroundColor: '#e0e0e0',
    margin: '16px 0',
  } as React.CSSProperties,
  logsSection: {
    marginTop: '8px',
  } as React.CSSProperties,
  logsSectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  } as React.CSSProperties,
  sectionTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#333',
  } as React.CSSProperties,
  viewAllButton: {
    padding: '6px 12px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    backgroundColor: '#fff',
    fontSize: '12px',
    color: '#666',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,
  logsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '300px',
    overflowY: 'auto',
  } as React.CSSProperties,
  logItem: {
    padding: '8px',
    border: '1px solid #e0e0e0',
    borderRadius: '4px',
    backgroundColor: '#fafafa',
    fontSize: '12px',
  } as React.CSSProperties,
  logMethod: {
    display: 'inline-block',
    padding: '2px 6px',
    backgroundColor: '#2196F3',
    color: '#fff',
    borderRadius: '2px',
    fontSize: '10px',
    fontWeight: 600,
    marginBottom: '4px',
  } as React.CSSProperties,
  logUrl: {
    color: '#333',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
  logMeta: {
    display: 'flex',
    gap: '8px',
    fontSize: '11px',
    color: '#666',
  } as React.CSSProperties,
  logStatus: {
    fontWeight: 500,
  } as React.CSSProperties,
  logRules: {
    color: '#4CAF50',
  } as React.CSSProperties,
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
