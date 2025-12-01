import { useState, useCallback } from 'react';
import { LogEntry, LogFilter } from '@/types';
import { uiController } from '@/ui/UIController';

/**
 * Hook for managing logs - fetching and clearing
 */
export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async (filter?: LogFilter) => {
    setLoading(true);
    setError(null);
    try {
      const fetchedLogs = await uiController.getLogs(filter);
      setLogs(fetchedLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }, []);

  const clearLogs = useCallback(async () => {
    await uiController.clearLogs();
    setLogs([]);
  }, []);

  return {
    logs,
    loading,
    error,
    fetchLogs,
    clearLogs
  };
}
