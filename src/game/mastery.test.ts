import { describe, expect, it } from 'vitest';
import type { SrsCard } from '../lib/srs';
import { entryMastery, unitMastery } from './mastery';

const card = (interval: number, reps = 1): SrsCard => ({ ease: 2.5, interval, due: '2026-12-01', reps, lapses: 0, correctTotal: reps, lastReviewed: '2026-11-14' });

describe('entryMastery', () => {
  it('follows the interval, with the gold level also needing 4 good answers in a row', () => {
    expect(entryMastery(undefined)).toBe(0);
    expect([0, 2, 3, 6, 7, 20, 21, 59].map((i) => entryMastery(card(i)))).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(entryMastery(card(60, 3))).toBe(4);
    expect(entryMastery(card(60, 4))).toBe(5);
  });
});

describe('unitMastery', () => {
  it('is the weakest entry', () => {
    const cards = { a: card(30), b: card(4), c: card(80, 6) };
    expect(unitMastery(['a', 'b', 'c'], cards)).toBe(2);
    expect(unitMastery(['a', 'c'], cards)).toBe(4);
    expect(unitMastery(['a', 'missing'], cards)).toBe(0);
    expect(unitMastery([], cards)).toBe(0);
  });
});
