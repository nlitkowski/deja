import { describe, expect, it } from 'vitest';
import { review, type SrsCard } from './srs';
import { buildSession, requeue, type SessionExercise } from './session';

const today = '2026-11-14';
const ids = Array.from({ length: 30 }, (_, i) => `p/e${i}`);
const entries = ids.map((id) => ({ id }));
const exercises: SessionExercise[] = ids.flatMap((id) => [
  { id: `${id}-a`, type: 'gap-fill', entryIds: [id] },
  { id: `${id}-b`, type: 'gap-fill', entryIds: [id] },
]);
const isProduction = () => true;

function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

function cardDue(due: string): SrsCard {
  return { ...review(undefined, 'good', '2026-11-01'), due };
}

describe('buildSession', () => {
  it('puts due cards first, oldest first, then new cards up to the daily limit', () => {
    const srs = { 'p/e5': cardDue('2026-11-13'), 'p/e6': cardDue('2026-11-10'), 'p/e7': cardDue('2026-11-20') };
    const items = buildSession({ entries, exercises, srs, today, newAllowed: 3, isProduction, mode: 'review', rng: seeded() });
    expect(items.map((i) => i.entryId)).toEqual(['p/e6', 'p/e5', 'p/e0', 'p/e1', 'p/e2']);
  });

  it('caps the session length', () => {
    const srs = Object.fromEntries(ids.map((id) => [id, cardDue('2026-11-01')]));
    const items = buildSession({ entries, exercises, srs, today, newAllowed: 5, isProduction, mode: 'review', maxItems: 18 });
    expect(items).toHaveLength(18);
  });

  it('skips deprecated entries and entries without exercises', () => {
    const items = buildSession({
      entries: [{ id: 'p/e0', deprecated: true }, { id: 'p/none' }, { id: 'p/e1' }],
      exercises,
      srs: {},
      today,
      newAllowed: 5,
      isProduction,
      mode: 'review',
    });
    expect(items.map((i) => i.entryId)).toEqual(['p/e1']);
  });

  it('tops up a practice session with early reviews', () => {
    const srs = Object.fromEntries(ids.map((id) => [id, cardDue('2026-12-01')]));
    const items = buildSession({ entries, exercises, srs, today, newAllowed: 0, isProduction, mode: 'practice', minPracticeItems: 4 });
    expect(items).toHaveLength(4);
    expect(items.every((i) => i.early)).toBe(true);
  });

  it('prefers production exercises', () => {
    const mixed: SessionExercise[] = [
      { id: 'x-prod', type: 'gap-fill', entryIds: ['p/e0'] },
      { id: 'x-mc', type: 'multiple-choice', entryIds: ['p/e0'] },
    ];
    const items = buildSession({
      entries: [{ id: 'p/e0' }],
      exercises: mixed,
      srs: {},
      today,
      newAllowed: 1,
      isProduction: (t) => t === 'gap-fill',
      mode: 'review',
      recognitionShare: 0,
    });
    expect(items[0]?.exerciseId).toBe('x-prod');
  });
});

describe('requeue', () => {
  const queue = ['a', 'b', 'c', 'd', 'e', 'f'].map((e) => ({ exerciseId: `${e}-x`, entryId: e, early: false, attempt: 1 }));

  it('puts the failed entry back a few cards later with another exercise', () => {
    const cands = [
      { id: 'b-x', type: 'gap-fill', entryIds: ['b'] },
      { id: 'b-y', type: 'gap-fill', entryIds: ['b'] },
    ];
    const next = requeue(queue, 1, queue[1]!, cands, isProduction);
    expect(next).toHaveLength(7);
    expect(next[5]).toMatchObject({ entryId: 'b', exerciseId: 'b-y', attempt: 2 });
  });

  it('appends near the end of the queue and stops after max attempts', () => {
    const last = queue[5]!;
    expect(requeue(queue, 5, last, [], isProduction).at(-1)).toMatchObject({ entryId: 'f', attempt: 2 });
    expect(requeue(queue, 5, { ...last, attempt: 3 }, [], isProduction)).toHaveLength(6);
  });
});
