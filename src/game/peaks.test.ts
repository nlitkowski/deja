import { describe, expect, it } from 'vitest';
import { addDays } from '../lib/date';
import type { BaselineEvent, ProgressEvent } from '../lib/progress/events';
import { foldEvents } from '../lib/progress/fold';
import type { SrsCard } from '../lib/srs';
import { mapState, type MapPack } from './map';
import { entryMastery, unitMastery } from './mastery';
import { unitPeaks, type PeakUnit } from './peaks';
import { answer } from './testEvents';

const card = (interval: number): SrsCard => ({ ease: 2.5, interval, due: '2026-12-20', reps: 3, lapses: 0, correctTotal: 3, lastReviewed: '2026-11-14' });
const ids = (n: number, prefix = 'e') => Array.from({ length: n }, (_, i) => `p/${prefix}${i}`);

function baseline(cards: Record<string, SrsCard>): BaselineEvent {
  return { type: 'baseline', id: 'b0', deviceId: 'd0', at: '2026-11-01T08:00:00Z', day: '2026-11-01', cards };
}

/** 20 entries at mastery 4, then one forgotten. */
function lapseLog(): ProgressEvent[] {
  const entries = ids(20);
  return [
    baseline(Object.fromEntries(entries.map((id) => [id, card(30)]))),
    answer({ day: '2026-11-14', entryIds: ['p/e0'], grade: 'again', correct: false }),
  ];
}

describe('unitPeaks', () => {
  it('remembers the highest crown while the current one drops after a mistake', () => {
    const units: PeakUnit[] = [{ key: 'p/u', entryIds: ids(20) }];
    const log = lapseLog();
    const state = foldEvents(log);
    expect(entryMastery(state.cards['p/e0'])).toBe(1);
    expect(unitMastery(units[0]!.entryIds, state.cards)).toBe(3);
    expect(unitPeaks(log, units).get('p/u')).toBe(4);
  });

  it('never drops, whatever order the events arrive in', () => {
    const events = [
      ...lapseLog(),
      answer({ day: '2026-11-16', entryIds: ['p/e1'], grade: 'again', correct: false }),
      answer({ day: '2026-11-17', entryIds: ['p/e0'] }),
      answer({ day: '2026-11-20', entryIds: ['p/e0'] }),
    ];
    const orders = [events, [...events].reverse(), [events[2]!, events[0]!, events[4]!, events[1]!, events[3]!]];
    for (const order of orders) {
      const units: PeakUnit[] = [{ key: 'p/u', entryIds: ids(20) }];
      let log: ProgressEvent[] = [];
      let last = 0;
      for (const event of order) {
        log = [...log, event];
        const peak = unitPeaks(log, units).get('p/u') ?? 0;
        expect(peak).toBeGreaterThanOrEqual(last);
        last = peak;
      }
      expect(last).toBe(4);
    }
  });

  it('new entries in a unit lower the current crown but not the peak', () => {
    const log = lapseLog();
    const before = unitPeaks(log, [{ key: 'p/u', entryIds: ids(20) }]);
    const grown: PeakUnit[] = [{ key: 'p/u', entryIds: [...ids(20), ...ids(5, 'new')] }];
    const state = foldEvents(log);
    expect(unitMastery(grown[0]!.entryIds, state.cards)).toBeLessThan(3);
    expect(unitPeaks(log, grown, before).get('p/u')).toBe(4);
    const map = mapState([{ id: 'p', requires: [], units: grown }], state.cards, new Set(), new Set(), unitPeaks(log, grown, before));
    expect(map.get('p')!.units[0]).toMatchObject({ peak: 4, golden: false });
    expect(map.get('p')!.units[0]!.mastery).toBeLessThan(3);
  });
});

describe('unlocks after the crown change', () => {
  /** The rule before: a unit opened once the previous one's weakest entry was seen (the old minimum crown ≥ 1). */
  function oldLocks(packs: readonly MapPack[], cards: Record<string, SrsCard>) {
    return packs.map((pack) =>
      pack.units.map((_, i) => {
        const previous = [...pack.units.slice(0, i)].reverse().find((u) => !u.optional);
        return !!previous && Math.min(...previous.entryIds.map((id) => entryMastery(cards[id]))) < 1;
      }),
    );
  }

  it('open the same units as before on a recorded log, day by day', () => {
    const packs: MapPack[] = [
      {
        id: 'p',
        requires: [],
        units: [
          { key: 'p/u0', entryIds: ids(6, 'a'), optional: true },
          { key: 'p/u1', entryIds: ids(8, 'b') },
          { key: 'p/u2', entryIds: ids(8, 'c') },
          { key: 'p/u3', entryIds: ids(8, 'd') },
        ],
      },
    ];
    const pool = packs[0]!.units.flatMap((u) => u.entryIds);
    // A month of answers: 6 a day, every 5th one wrong, walking through the entries in a fixed scramble.
    const log: ProgressEvent[] = [];
    for (let i = 0; i < 180; i++) {
      const day = addDays('2026-10-01', Math.floor(i / 6));
      const wrong = i % 5 === 4;
      log.push(answer({ day, at: `${day}T10:${String(i % 60).padStart(2, '0')}:00Z`, entryIds: [pool[(i * 7) % 22]!], grade: wrong ? 'again' : 'good', correct: !wrong }));
    }
    for (let n = 0; n <= log.length; n += 6) {
      const cards = foldEvents(log.slice(0, n)).cards;
      const now = mapState(packs, cards, new Set());
      expect(packs.map((p) => now.get(p.id)!.units.map((u) => u.locked))).toEqual(oldLocks(packs, cards));
    }
  });
});
