import { useState, useCallback } from 'react';
import { uiController } from '@/ui/UIController';

/**
 * Hook for accessing the UIController with loading and error state
 */
export function useExtensionMessage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withState = useCallback(async <T>(operation: () => Promise<T>): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      const result = await operation();
      setLoading(false);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setLoading(false);
      throw err;
    }
  }, []);

  return { 
    controller: uiController,
    withState,
    loading, 
    error 
  };
}
