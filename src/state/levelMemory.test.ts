import { describe, expect, it } from 'vitest';
import { levelFromXp } from '../game/levels';
import { acknowledgeLevel, isNewLevel, levelsRecalculated } from './levelMemory';

function memoryKv(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => void values.set(k, v), removeItem: (k: string) => void values.delete(k) };
}

describe('level memory after the curve changed', () => {
  it('announces the recalculation once to a learner with XP, never to a new one', () => {
    const kv = memoryKv();
    expect(levelsRecalculated(0, kv)).toBe(false);
    expect(levelsRecalculated(5000, kv)).toBe(true);
    acknowledgeLevel(levelFromXp(5000).level, kv);
    expect(levelsRecalculated(5000, kv)).toBe(false);
  });

  it('does not celebrate a level already shown after the recalculation', () => {
    // 5 000 XP: level 5 on the new curve (it was much higher on the old one).
    const kv = memoryKv();
    acknowledgeLevel(levelFromXp(5000).level, kv);
    expect(levelFromXp(5000).level).toBe(5);
    expect(isNewLevel(5, kv)).toBe(false);
    expect(isNewLevel(4, kv)).toBe(false);
    expect(isNewLevel(6, kv)).toBe(true);
    acknowledgeLevel(6, kv);
    expect(isNewLevel(6, kv)).toBe(false);
  });

  it('treats a memory from the old curve as nothing shown yet', () => {
    const kv = memoryKv({ 'deja:level-shown': JSON.stringify({ curve: 1, level: 9 }) });
    expect(levelsRecalculated(100, kv)).toBe(true);
    acknowledgeLevel(2, kv);
    expect(isNewLevel(3, kv)).toBe(true);
  });
});
