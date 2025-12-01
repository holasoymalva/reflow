import { useState, useCallback } from 'react';
import { uiController } from '@/ui/UIController';

/**
 * Hook for managing global pause state
 */
export function useGlobalPause() {
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);

  const togglePause = useCallback(async (paused: boolean) => {
    setLoading(true);
    try {
      await uiController.toggleGlobalPause(paused);
      setIsPaused(paused);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    isPaused,
    loading,
    togglePause
  };
}
