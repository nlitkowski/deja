import { describe, expect, it } from 'vitest';
import type { QuestEvent } from '../../lib/progress/events';
import { answer, ctx, goalChange, session } from '../testEvents';
import { totalXp } from '../xp';
import { DAILY_QUESTS, questDigest, questsFor, questStatus, seededRandom, weekStart, WEEKLY_QUESTS } from '.';

const digestCtx = { ...ctx, isTricky: (id: string) => id === 'p/trap' };
const quest = (id: string) => [...DAILY_QUESTS, ...WEEKLY_QUESTS].find((q) => q.id === id)!;

describe('quest selection', () => {
  it('picks 3 daily quests and 1 weekly, the same on every device for a given day', () => {
    const today = questsFor('2026-11-14');
    expect(today.filter((q) => q.quest.period === 'day')).toHaveLength(3);
    expect(today.filter((q) => q.quest.period === 'week')).toHaveLength(1);
    expect(new Set(today.map((q) => q.quest.id)).size).toBe(4);
    expect(questsFor('2026-11-14').map((q) => q.quest.id)).toEqual(today.map((q) => q.quest.id));
    const days = ['2026-11-15', '2026-11-16', '2026-11-17'].map((d) => questsFor(d).map((q) => q.quest.id).join());
    expect(new Set(days).size).toBeGreaterThan(1);
  });

  it('keeps the weekly quest for the whole week, starting on Monday', () => {
    expect(weekStart('2026-11-14')).toBe('2026-11-09');
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
    const weekly = (d: string) => questsFor(d).find((q) => q.quest.period === 'week');
    expect(weekly('2026-11-15')).toEqual(weekly('2026-11-09'));
  });

  it('has a deterministic random source', () => {
    const a = seededRandom('x');
    const b = seededRandom('x');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('quest progress', () => {
  const day = '2026-11-14';
  const digest = (events: Parameters<typeof questDigest>[0], from = day) => questDigest(events, from, day, digestCtx);

  it('counts answers of the period only', () => {
    const d = digest([answer({ day: '2026-11-13' }), answer({ comboBefore: 6 }), answer({ correct: false }), answer({ entryIds: ['p/trap'] })]);
    expect(quest('combo-10').progress(d)).toBe(7);
    expect(quest('pieges').progress(d)).toBe(1);
    expect(quest('vingt-ecrites').progress(d)).toBe(2);
    expect(quest('sans-accent').progress(d)).toBe(2);
  });

  it('sees weak cards as they were before the answer', () => {
    const at = (h: number) => `${day}T${String(h).padStart(2, '0')}:00:00Z`;
    const d = digest([answer({ at: at(8), correct: false, grade: 'again' }), answer({ at: at(9) }), answer({ at: at(10), entryIds: ['p/new'] })]);
    expect(quest('points-faibles').progress(d)).toBe(1);
  });

  it('finds a session without hints', () => {
    const d = digest([
      session({ sessionId: 's1', items: 5 }),
      session({ sessionId: 's2', items: 5 }),
      answer({ sessionId: 's2', hintUsed: true }),
      session({ sessionId: 's3', items: 2 }),
    ]);
    expect(quest('sans-indice').progress(d)).toBe(1);
  });

  it('measures the week against the goal in force each day', () => {
    const events = [goalChange(30, '2026-11-09'), ...['2026-11-09', '2026-11-10'].flatMap((d) => [1, 2, 3].map((i) => answer({ day: d, entryIds: [`p/${d}${i}`] })))];
    const d = digest(events, '2026-11-09');
    expect(quest('objectif-5-jours').progress(d)).toBe(2);
    expect(quest('xp-500').progress(d)).toBe(72);
    expect(quest('double-objectif').target(digest(events))).toBe(60);
  });
});

describe('questStatus', () => {
  it('marks done and claimed quests; a claim is an event that carries the XP', () => {
    const today = questsFor('2026-11-14');
    const first = today[0]!;
    const claim: QuestEvent = { type: 'quest', id: 'q1', deviceId: 'd', at: '2026-11-14T20:00:00Z', day: '2026-11-14', questId: first.quest.id, period: first.period, xp: 20 };
    const status = questStatus([claim], '2026-11-14', digestCtx);
    expect(status).toHaveLength(4);
    expect(status[0]).toMatchObject({ claimed: true, reward: 50 });
    expect(status[3]).toMatchObject({ claimed: false, reward: 250 });
    expect(totalXp([claim], ctx)).toBe(20);
  });
});
