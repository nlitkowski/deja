import { useMemo } from 'react';
import { levelFromXp } from '../game/levels';
import { streakInfo } from '../game/streak';
import { totalXp } from '../game/xp';
import { dayKey } from '../lib/date';
import { xpContext } from '../xpContext';
import { useAppStore } from './appStore';

/** XP, level and streak derived from the event log, for today. */
export function useGame() {
  const log = useAppStore((s) => s.log);
  const today = dayKey(new Date());
  return useMemo(() => {
    const xp = totalXp(log, xpContext);
    return { xp, level: levelFromXp(xp), streak: streakInfo(log, today, xpContext) };
  }, [log, today]);
}
