import { describe, expect, it } from 'vitest';
import { review, type SrsCard } from '../lib/srs';
import { entriesBelow, entryMastery, unitMastery } from './mastery';

const card = (interval: number, reps = 1): SrsCard => ({ ease: 2.5, interval, due: '2026-12-01', reps, lapses: 0, correctTotal: reps, lastReviewed: '2026-11-14' });

describe('entryMastery', () => {
  it('follows the interval, with the gold level also needing 4 good answers in a row', () => {
    expect(entryMastery(undefined)).toBe(0);
    expect([0, 2, 3, 6, 7, 19, 20, 59].map((i) => entryMastery(card(i)))).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
    expect(entryMastery(card(60, 3))).toBe(4);
    expect(entryMastery(card(60, 4))).toBe(5);
  });

  it('reaches mastery 4 on the fourth good answer, each on its due day', () => {
    let c: SrsCard | undefined;
    let day = '2026-11-01';
    for (let i = 0; i < 4; i++) {
      c = review(c, 'good', day);
      day = c.due;
    }
    expect(c!.interval).toBe(20);
    expect(entryMastery(c)).toBe(4);
  });
});

describe('unitMastery', () => {
  const unit = (levels: number[]) => {
    const intervals = [0, 0, 3, 7, 20, 60];
    const cards = Object.fromEntries(levels.flatMap((m, i) => (m ? [[`e${i}`, card(intervals[m]!, m === 5 ? 4 : 1)]] : [])));
    return { ids: levels.map((_, i) => `e${i}`), cards };
  };
  const crown = (levels: number[]) => {
    const { ids, cards } = unit(levels);
    return unitMastery(ids, cards);
  };
  const of = (n: number, level: number) => Array<number>(n).fill(level);

  it('one mistake does not drop a unit from 4 to 1: 19 entries at 4 and one at 1 make crown 3', () => {
    expect(crown([...of(19, 4), 1])).toBe(3);
    // Back at mastery 2, the lagging entry is within the gap again.
    expect(crown([...of(19, 4), 2])).toBe(4);
  });

  it('needs 80% of the entries at the level: 16 of 20, not 15', () => {
    expect(crown([...of(16, 4), ...of(4, 3)])).toBe(4);
    expect(crown([...of(15, 4), ...of(5, 3)])).toBe(3);
    expect(crown([...of(16, 5), ...of(4, 4)])).toBe(5);
  });

  it('no entry may lag more than 2 levels behind', () => {
    expect(crown([...of(19, 5), 3])).toBe(5);
    expect(crown([...of(19, 5), 2])).toBe(4);
    expect(crown([...of(19, 5), 0])).toBe(2);
    expect(crown([...of(19, 3), 0])).toBe(2);
  });

  it('is 0 for an empty or unseen unit', () => {
    expect(crown([])).toBe(0);
    expect(crown(of(10, 0))).toBe(0);
  });
});

describe('entriesBelow', () => {
  it('names the entries that keep the crown under its peak', () => {
    const levels = [...Array<number>(19).fill(4), 1];
    const intervals = [0, 0, 3, 7, 20, 60];
    const cards = Object.fromEntries(levels.map((m, i) => [`e${i}`, card(intervals[m]!)]));
    const ids = levels.map((_, i) => `e${i}`);
    expect(entriesBelow(ids, cards, 4)).toEqual(['e19']);
    // Five at 3: 15/20 at 4, one more is needed for 80%.
    const short = { ...cards, e19: card(20), e0: card(7), e1: card(7), e2: card(7), e3: card(7), e4: card(7) };
    expect(entriesBelow(ids, short, 4)).toHaveLength(1);
    expect(unitMastery(ids, short)).toBe(3);
  });
});
