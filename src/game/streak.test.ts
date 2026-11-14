import { describe, expect, it } from 'vitest';
import { addDays } from '../lib/date';
import { goalResolver, streakInfo } from './streak';
import { answer, ctx, goalChange } from './testEvents';

/** `n` correct typed answers (12 XP each) on one day. */
const day = (d: string, n: number) => Array.from({ length: n }, () => answer({ day: d }));
const days = (from: string, count: number, perDay: number) => Array.from({ length: count }, (_, i) => day(addDays(from, i), perDay)).flat();

describe('streakInfo', () => {
  it('counts days in a row with the goal met (default goal 50 = 5 answers)', () => {
    const events = [...days('2026-11-10', 4, 5), ...day('2026-11-14', 2)];
    expect(streakInfo(events, '2026-11-14', ctx)).toEqual({ current: 4, best: 4, freezes: 0, todayXp: 24, todayDone: false, goal: 50 });
    expect(streakInfo([...events, ...day('2026-11-14', 3)], '2026-11-14', ctx)).toMatchObject({ current: 5, todayDone: true });
  });

  it('breaks on a missed day without a freeze', () => {
    const events = [...days('2026-11-01', 3, 5), ...days('2026-11-05', 2, 5)];
    expect(streakInfo(events, '2026-11-07', ctx)).toMatchObject({ current: 2, best: 3 });
    expect(streakInfo(events, '2026-11-08', ctx)).toMatchObject({ current: 0, best: 3 });
  });

  it('earns a freeze every 7 days, keeps at most 2 and spends them on missed days', () => {
    const events = [...days('2026-10-01', 21, 5), ...days('2026-10-25', 2, 5)];
    // 21 days earn 3 freezes, capped at 2; of the missed 22–24 Oct two are frozen and the third breaks the streak.
    expect(streakInfo(events, '2026-10-21', ctx)).toMatchObject({ current: 21, freezes: 2 });
    expect(streakInfo(events, '2026-10-24', ctx)).toMatchObject({ current: 21, freezes: 0 });
    expect(streakInfo(events, '2026-10-27', ctx)).toMatchObject({ current: 2, best: 21, freezes: 0 });
  });

  it('keeps the streak across one missed day with a freeze', () => {
    const events = [...days('2026-11-01', 7, 5), ...days('2026-11-09', 2, 5)];
    expect(streakInfo(events, '2026-11-11', ctx)).toMatchObject({ current: 9, freezes: 0 });
  });

  it('judges past days by the goal in force on that day', () => {
    const events = [...days('2026-11-10', 2, 3), goalChange(30, '2026-11-12'), ...days('2026-11-12', 2, 3)];
    // 36 XP a day: below the default 50 before the change, enough for 30 from 12 Nov.
    expect(streakInfo(events, '2026-11-13', ctx)).toMatchObject({ current: 2, best: 2, goal: 30, todayDone: true });
    const raised = [...events, goalChange(100, '2026-11-13')];
    expect(streakInfo(raised, '2026-11-13', ctx)).toMatchObject({ current: 1, goal: 100, todayDone: false });
  });

  it('does not depend on the order of the events', () => {
    const events = [...days('2026-10-01', 9, 5), goalChange(30, '2026-10-05'), ...days('2026-10-12', 3, 3)];
    const info = streakInfo(events, '2026-10-14', ctx);
    expect(streakInfo([...events].reverse(), '2026-10-14', ctx)).toEqual(info);
  });

  it('is empty without history', () => {
    expect(streakInfo([], '2026-11-14', ctx)).toEqual({ current: 0, best: 0, freezes: 0, todayXp: 0, todayDone: false, goal: 50 });
  });
});

describe('goalResolver', () => {
  it('uses the last change made on or before the day', () => {
    const goalOn = goalResolver([goalChange(100, '2026-11-12'), goalChange(30, '2026-11-10')]);
    expect([goalOn('2026-11-09'), goalOn('2026-11-10'), goalOn('2026-11-12')]).toEqual([50, 30, 100]);
  });
});
