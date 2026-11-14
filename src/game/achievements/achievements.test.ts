import { describe, expect, it } from 'vitest';
import { addDays } from '../../lib/date';
import { answer, ctx, session } from '../testEvents';
import { achievementStats, BADGES, bossAchievements, unlockedIds } from '.';
import type { StatsInput } from './stats';

const input: StatsInput = { cards: {}, units: [], today: '2026-11-14', xp: ctx };
const stats = (events: Parameters<typeof achievementStats>[0], over: Partial<StatsInput> = {}) => achievementStats(events, { ...input, ...over });

describe('badge registry', () => {
  it('collects every badge file with unique ids', () => {
    const ids = BADGES.map((b) => b.id);
    expect(ids.length).toBeGreaterThanOrEqual(17);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(['premiere-seance', 'flamme-100', 'bonnes-reponses-1000', 'combo-50', 'sans-faute', 'maitrise']));
    for (const b of BADGES) expect(b.description.pl && b.description.fr).toBeTruthy();
  });

  it('adds one badge per boss', () => {
    const [boss] = bossAchievements([{ key: 'p/u1', title: 'Prépositions' }]);
    expect(boss!.check(stats([session({ kind: 'boss', unitKey: 'p/u1', defeated: true })]))).toBe(true);
    expect(boss!.check(stats([session({ kind: 'boss', unitKey: 'p/u1', defeated: false })]))).toBe(false);
  });
});

describe('achievementStats', () => {
  it('counts sessions, perfect ones, correct answers and the best combo', () => {
    const s = stats([
      session({ items: 12, mistakes: 0 }),
      session({ items: 4, mistakes: 0 }),
      answer({ comboBefore: 11 }),
      answer({ correct: false }),
      answer(),
    ]);
    expect(s).toMatchObject({ sessions: 2, perfectSessions: 1, correct: 2, maxCombo: 12 });
    expect(unlockedIds(BADGES, s)).toEqual(new Set(['premiere-seance', 'sans-faute', 'combo-10']));
  });

  it('measures the longest run without a missing accent', () => {
    const run = (n: number) => Array.from({ length: n }, (_, i) => answer({ at: `2026-11-14T10:${String(i).padStart(2, '0')}:00Z` }));
    const events = [...run(30), answer({ at: '2026-11-14T11:00:00Z', nearMiss: true }), ...run(20).map((e) => ({ ...e, at: e.at.replace('T10', 'T12') }))];
    expect(stats(events).accentRun).toBe(30);
  });

  it('spots a rescue: right after three mistakes in a row on the same entry', () => {
    const at = (m: number) => `2026-11-14T10:0${m}:00Z`;
    const wrong = (m: number, entry = 'p/a') => answer({ at: at(m), correct: false, entryIds: [entry] });
    expect(stats([wrong(1), wrong(2), wrong(3), answer({ at: at(4) })]).rescues).toBe(1);
    expect(stats([wrong(1), wrong(2), answer({ at: at(3) }), wrong(4), answer({ at: at(5) })]).rescues).toBe(0);
    expect(stats([wrong(1), wrong(2, 'p/b'), wrong(3), answer({ at: at(4) })]).rescues).toBe(0);
  });

  it('takes the best streak and golden units from the projection', () => {
    const days = Array.from({ length: 3 }, (_, d) => Array.from({ length: 5 }, (_, i) => answer({ day: addDays('2026-11-10', d), entryIds: [`p/${d}-${i}`] }))).flat();
    const gold = { ease: 2.5, interval: 90, due: '2027-02-01', reps: 6, lapses: 0, correctTotal: 6, lastReviewed: '2026-11-01' };
    const s = stats(days, { cards: { a: gold }, units: [{ key: 'u', entryIds: ['a'] }] });
    expect(s.bestStreak).toBe(3);
    expect(s.goldenUnits).toBe(1);
    expect(unlockedIds(BADGES, s)).toEqual(new Set(['flamme-3', 'maitrise']));
  });
});
