import { useCallback, useEffect, useState } from 'react';
import { dayKey } from './lib/date';
import { loadState, rollDay, saveState, type SavedState } from './lib/storage';

export function useAppState() {
  const [state, setState] = useState<SavedState>(() => rollDay(loadState(), dayKey(new Date())));

  useEffect(() => {
    saveState(state);
  }, [state]);

  const update = useCallback((fn: (s: SavedState) => SavedState) => {
    setState((s) => fn(rollDay(s, dayKey(new Date()))));
  }, []);

  return [state, update] as const;
}
