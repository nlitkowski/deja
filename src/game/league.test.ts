import { describe, expect, it } from 'vitest';
import { addDays } from '../lib/date';
import { league } from './league';
import { answer, ctx } from './testEvents';

/** `n` answers worth 12 XP each, each about its own entry so mastery never lowers the XP. */
const xpOn = (day: string, n: number) => Array.from({ length: n }, (_, i) => answer({ day, at: `${day}T10:00:00Z`, entryIds: [`p/${day}-${i}`] }));

describe('league', () => {
  it('ranks you against 4 ghosts and 5 bots, with the days left in the week', () => {
    const l = league(xpOn('2026-11-14', 5), '2026-11-14', ctx);
    expect(l.rows).toHaveLength(10);
    expect(l.rows.filter((r) => r.kind === 'ghost').map((r) => r.weeksAgo).sort()).toEqual([1, 2, 3, 4]);
    expect(l.rows.filter((r) => r.kind === 'bot').every((r) => r.name)).toBe(true);
    expect(l).toMatchObject({ tier: 0, week: '2026-11-09', daysLeft: 1, history: [] });
    expect(l.rows[l.rank - 1]).toMatchObject({ kind: 'you', xp: 60 });
  });

  it('races ghosts over the same days of their week', () => {
    // Last week: 3 answers on Monday, 10 on Friday. Today is Tuesday.
    const events = [...xpOn('2026-11-02', 3), ...xpOn('2026-11-06', 10), ...xpOn('2026-11-09', 1)];
    const ghost = league(events, '2026-11-10', ctx).rows.find((r) => r.weeksAgo === 1);
    expect(ghost?.xp).toBe(36);
  });

  it('is the same on every device, and bots follow your median week', () => {
    const small = league(xpOn('2026-11-02', 2), '2026-11-14', ctx);
    expect(league(xpOn('2026-11-02', 2), '2026-11-14', ctx)).toEqual(small);
    const big = league(xpOn('2026-11-02', 40), '2026-11-14', ctx);
    const botXp = (l: typeof small) => l.rows.filter((r) => r.kind === 'bot').reduce((s, r) => s + r.xp, 0);
    expect(botXp(big)).toBeGreaterThan(botXp(small) * 5);
  });

  it('moves up from the top 3 and down from the last 2, week after week', () => {
    // Weeks 1–2 strong: up twice. Week 3 empty: last place, down one.
    const events = [...xpOn('2026-10-12', 60), ...xpOn('2026-10-19', 100)];
    const l = league(events, addDays('2026-10-26', 9), ctx);
    expect(l.history.map((h) => h.tier)).toEqual([0, 1, 2]);
    expect(l.history[0]!.rank).toBe(1);
    expect(l.history[2]!.rank).toBe(10);
    expect(l.tier).toBe(1);
  });
});
