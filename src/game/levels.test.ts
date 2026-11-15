import { describe, expect, it } from 'vitest';
import { levelFromXp, xpForLevel } from './levels';

describe('levels', () => {
  it('follows 150 · n² per level', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([150, 600, 1350, 2400]);
  });

  it('starts each level at its cumulative threshold', () => {
    const thresholds = [0, 150, 750, 2100, 4500, 8250, 13650, 21000, 30600, 42750, 57750, 75900];
    thresholds.forEach((xp, i) => {
      expect(levelFromXp(xp).level).toBe(i + 1);
      if (xp) expect(levelFromXp(xp - 1).level).toBe(i);
    });
  });

  it('turns cumulative XP into a level with progress', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, title: 'Débutant', intoLevel: 0, toNext: 150, span: 150 });
    expect(levelFromXp(150)).toEqual({ level: 2, title: 'Touriste', intoLevel: 0, toNext: 600, span: 600 });
    expect(levelFromXp(1000)).toMatchObject({ level: 3, title: 'Flâneur', intoLevel: 250, toNext: 1100 });
    expect(levelFromXp(57_750).title).toBe('Académicien');
  });

  it('keeps Immortel past level 12 while the number grows', () => {
    expect(levelFromXp(75_900)).toMatchObject({ level: 12, title: 'Immortel' });
    const high = levelFromXp(500_000);
    expect(high.level).toBeGreaterThan(12);
    expect(high.title).toBe('Immortel');
  });
});
