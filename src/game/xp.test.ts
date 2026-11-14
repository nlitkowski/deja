import { describe, expect, it } from 'vitest';
import { answer, ctx, session } from './testEvents';
import { answerXp, comboMultiplier, sessionXp, totalXp, xpByDay } from './xp';

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

describe('session XP', () => {
  it('adds the completion bonus, and the perfect bonus from 10 items without mistakes', () => {
    expect(totalXp([session({ items: 9 })], ctx)).toBe(10);
    expect(totalXp([session({ items: 10 })], ctx)).toBe(30);
    expect(totalXp([session({ items: 12, mistakes: 1 })], ctx)).toBe(10);
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
