import { describe, expect, it } from 'vitest';
import type { QuestEvent } from '../lib/progress/events';
import { answer, ctx, session } from './testEvents';
import { answerXp, comboMultiplier, scoreEvents, sessionXp, totalXp, xpByDay } from './xp';

describe('answerXp', () => {
  it('gives nothing for a wrong answer', () => {
    expect(answerXp(answer({ correct: false, grade: 'again' }), ctx)).toEqual({ total: 0, combo: 0 });
  });

  it('applies the base, hint and near-miss multipliers', () => {
    expect(answerXp(answer(), ctx).total).toBe(12);
    expect(answerXp(answer({ hintUsed: true }), ctx).total).toBe(10);
    expect(answerXp(answer({ nearMiss: true }), ctx).total).toBe(6);
    expect(answerXp(answer({ nearMiss: true, hintUsed: true }), ctx).total).toBe(5);
    expect(answerXp(answer({ exerciseId: 'p/chosen' }), ctx).total).toBe(5);
    expect(answerXp(answer({ exerciseId: 'p/chosen', hintUsed: true }), ctx).total).toBe(4);
    expect(answerXp(answer({ exerciseId: 'p/chosen', nearMiss: true, hintUsed: true }), ctx).total).toBe(2);
  });

  it('multiplies by the combo, counting this answer', () => {
    expect(comboMultiplier(4)).toBe(1);
    expect(comboMultiplier(5)).toBe(1.5);
    expect(comboMultiplier(9)).toBe(1.5);
    expect(comboMultiplier(10)).toBe(2);
    expect(answerXp(answer({ comboBefore: 3 }), ctx)).toEqual({ total: 12, combo: 0 });
    expect(answerXp(answer({ comboBefore: 4 }), ctx)).toEqual({ total: 18, combo: 6 });
    expect(answerXp(answer({ comboBefore: 9 }), ctx)).toEqual({ total: 24, combo: 12 });
    expect(answerXp(answer({ comboBefore: 9, nearMiss: true, hintUsed: true }), ctx)).toEqual({ total: 10, combo: 5 });
  });
});

describe('mastered entries', () => {
  it('halve the XP once every entry of the answer was at mastery 5 before it', () => {
    expect(answerXp(answer(), ctx, true).total).toBe(6);
    // Good answers spaced along the growing interval until the card reaches mastery 5.
    const days = ['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-13', '2026-02-03', '2026-04-01', '2026-09-01'];
    const scored = scoreEvents(
      days.map((day) => answer({ day, at: `${day}T10:00:00Z` })),
      ctx,
    ).map((s) => s.xp);
    expect(scored.slice(0, 5)).toEqual([12, 12, 12, 12, 12]);
    expect(scored.at(-1)).toBe(6);
  });

  it('takes the stored production flag over the exercise type', () => {
    expect(answerXp(answer({ exerciseId: 'p/chosen', production: true }), ctx).total).toBe(12);
    expect(answerXp(answer({ production: false }), ctx).total).toBe(5);
  });
});

describe('session XP', () => {
  it('adds the completion bonus, and the perfect bonus from 10 items without mistakes', () => {
    expect(totalXp([session({ items: 9 })], ctx)).toBe(10);
    expect(totalXp([session({ items: 10 })], ctx)).toBe(30);
    expect(totalXp([session({ items: 12, mistakes: 1 })], ctx)).toBe(10);
  });

  it('adds 100 for a defeated boss, nothing extra for a lost one', () => {
    expect(totalXp([session({ kind: 'boss', items: 4, mistakes: 3, defeated: false })], ctx)).toBe(10);
    expect(totalXp([session({ kind: 'boss', items: 10, mistakes: 2, defeated: true })], ctx)).toBe(110);
  });

  it('splits one session into answers, combo and bonuses', () => {
    const events = [
      answer({ sessionId: 's1', comboBefore: 0 }),
      answer({ sessionId: 's1', comboBefore: 4 }),
      answer({ sessionId: 'other' }),
      session({ sessionId: 's1', items: 2 }),
    ];
    expect(sessionXp(events, 's1', ctx)).toEqual({ answers: 24, combo: 6, bonus: 10, total: 40 });
  });
});

describe('xpByDay', () => {
  it('sums XP per learning day, independent of order', () => {
    const events = [answer({ day: '2026-11-13' }), answer({ day: '2026-11-14' }), answer({ day: '2026-11-14', correct: false })];
    const byDay = xpByDay(events, ctx);
    expect(Object.fromEntries(byDay)).toEqual({ '2026-11-13': 12, '2026-11-14': 12 });
    expect(xpByDay([...events].reverse(), ctx)).toEqual(byDay);
  });
});

describe('one-time rewards after sync', () => {
  const claim = (id: string, deviceId: string, at: string): QuestEvent => ({ type: 'quest', id, deviceId, at, day: '2026-11-14', questId: 'daily/x', period: '2026-11-14', xp: 20 });
  const phone = claim('q-phone', 'phone', '2026-11-14T10:00:00.000Z');
  const laptop = claim('q-laptop', 'laptop', '2026-11-14T11:00:00.000Z');
  const xpOf = (log: QuestEvent[]) => new Map(scoreEvents(log, { isProduction: () => true }).map((s) => [s.event.id, s.xp]));

  it('pays a quest claimed on two devices once, to the earlier claim, whatever the log order', () => {
    expect(xpOf([phone, laptop])).toEqual(new Map([['q-phone', 20], ['q-laptop', 0]]));
    expect(xpOf([laptop, phone])).toEqual(new Map([['q-phone', 20], ['q-laptop', 0]]));
  });

  it('pays once whether the second claim arrives later or earlier than the first', () => {
    const own = { isProduction: () => true };
    expect(totalXp([phone], own)).toBe(20);
    expect(totalXp([phone, laptop], own)).toBe(20); // newer: scored incrementally
    expect(totalXp([laptop], own)).toBe(20);
    const merged = [laptop, phone]; // older: rescored from scratch
    expect(totalXp(merged, own)).toBe(20);
    expect(scoreEvents(merged, own).find((s) => s.event.id === 'q-phone')?.xp).toBe(20);
  });

  it('pays a session bonus once per session, even if the session arrives twice', () => {
    const first = session({ id: 'a', sessionId: 'same' });
    const copy = session({ id: 'b', sessionId: 'same' });
    expect(totalXp([first, copy], ctx)).toBe(totalXp([first], ctx));
    expect(totalXp([session({ sessionId: 'one' }), session({ sessionId: 'two' })], ctx)).toBe(2 * totalXp([first], ctx));
  });
});
