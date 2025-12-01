import { useState, useEffect, useCallback } from 'react';
import { Rule } from '@/types';
import { uiController } from '@/ui/UIController';

/**
 * Hook for managing rules - fetching, creating, updating, deleting
 */
export function useRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fetchedRules = await uiController.getRules();
      setRules(fetchedRules);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const createRule = useCallback(async (rule: Omit<Rule, 'id' | 'createdAt' | 'modifiedAt'>) => {
    const newRule = await uiController.createRule(rule);
    setRules(prev => [...prev, newRule]);
    return newRule;
  }, []);

  const updateRule = useCallback(async (id: string, updates: Partial<Rule>) => {
    const updatedRule = await uiController.updateRule(id, updates);
    setRules(prev => prev.map(r => r.id === id ? updatedRule : r));
    return updatedRule;
  }, []);

  const deleteRule = useCallback(async (id: string) => {
    await uiController.deleteRule(id);
    setRules(prev => prev.filter(r => r.id !== id));
  }, []);

  const toggleRule = useCallback(async (id: string, enabled: boolean) => {
    await uiController.toggleRule(id, enabled);
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled } : r));
  }, []);

  return {
    rules,
    loading,
    error,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule
  };
}
