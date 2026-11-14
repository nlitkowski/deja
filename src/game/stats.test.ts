import { describe, expect, it } from 'vitest';
import type { SrsCard } from '../lib/srs';
import { heatmap, masteryByPack, weakestEntries } from './stats';

const card = (over: Partial<SrsCard> = {}): SrsCard => ({ ease: 2.5, interval: 1, due: '2026-11-15', reps: 1, lapses: 0, correctTotal: 1, lastReviewed: '2026-11-14', ...over });

describe('heatmap', () => {
  it('lays out weeks from Monday up to today, shaded against the daily goal', () => {
    const xp = new Map([
      ['2026-11-09', 10],
      ['2026-11-10', 40],
      ['2026-11-11', 50],
      ['2026-11-12', 120],
    ]);
    const columns = heatmap(xp, () => 50, '2026-11-14', 2);
    expect(columns).toHaveLength(2);
    expect(columns[0]![0]!.day).toBe('2026-11-02');
    expect(columns[1]!.map((d) => d.level)).toEqual([1, 2, 3, 4, 0, 0]);
    expect(columns[1]!.at(-1)!.day).toBe('2026-11-14');
  });
});

describe('weakestEntries', () => {
  it('puts the most mistakes first, then the lowest ease, and skips entries without trouble', () => {
    const cards = { a: card({ lapses: 1, ease: 2.2 }), b: card({ lapses: 3 }), c: card({ ease: 1.9 }), d: card(), e: card({ lapses: 1, ease: 2.0 }) };
    expect(weakestEntries(['a', 'b', 'c', 'd', 'e', 'new'], cards)).toEqual(['b', 'e', 'a', 'c']);
    expect(weakestEntries(['a', 'b', 'c'], cards, 2)).toEqual(['b', 'a']);
  });
});

describe('masteryByPack', () => {
  it('counts entries per mastery level', () => {
    const counts = masteryByPack([{ id: 'p', requires: [], units: [{ key: 'u', entryIds: ['a', 'b', 'c'] }] }], { a: card(), b: card({ interval: 8 }) });
    expect(counts.get('p')).toEqual([1, 1, 0, 1, 0, 0]);
  });
});
