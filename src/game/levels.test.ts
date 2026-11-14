import { describe, expect, it } from 'vitest';
import { levelFromXp, xpForLevel } from './levels';

describe('levels', () => {
  it('follows round(50 · n^1.5) per level', () => {
    expect([1, 2, 3, 4].map(xpForLevel)).toEqual([50, 141, 260, 400]);
  });

  it('turns cumulative XP into a level with progress', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, title: 'Débutant', intoLevel: 0, toNext: 50, span: 50 });
    expect(levelFromXp(49).level).toBe(1);
    expect(levelFromXp(50)).toEqual({ level: 2, title: 'Touriste', intoLevel: 0, toNext: 141, span: 141 });
    expect(levelFromXp(200)).toMatchObject({ level: 3, title: 'Flâneur', intoLevel: 9, toNext: 251 });
  });

  it('keeps the last title while the level number grows', () => {
    const high = levelFromXp(100_000);
    expect(high.level).toBeGreaterThan(8);
    expect(high.title).toBe('Académicien');
  });
});
