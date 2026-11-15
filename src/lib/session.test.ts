import { describe, expect, it } from 'vitest';
import { review, type SrsCard } from './srs';
import { buildSession, interleave, requeue, type OtherSkill, type SessionExercise } from './session';

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

  it('uses recognition at about recognitionShare, only for entries last answered correctly', () => {
    const known = ids.slice(0, 10);
    const failed = ids.slice(10, 20);
    const srs = {
      ...Object.fromEntries(known.map((id) => [id, cardDue('2026-11-10')])),
      ...Object.fromEntries(failed.map((id) => [id, review(cardDue('2026-11-10'), 'again', '2026-11-12')])),
    };
    const withRecognition: SessionExercise[] = [...exercises, ...ids.map((id) => ({ id: `${id}-mc`, type: 'multiple-choice', entryIds: [id] }))];
    const isProd = (t: string) => t === 'gap-fill';
    const run = (recognitionShare: number, seed: number) =>
      buildSession({ entries, exercises: withRecognition, srs, today, newAllowed: 5, isProduction: isProd, mode: 'review', recognitionShare, rng: seeded(seed), maxItems: 30 });

    const picks = Array.from({ length: 40 }, (_, seed) => run(0.2, seed + 1)).flat();
    const recognition = picks.filter((i) => i.exerciseId.endsWith('-mc'));
    expect(recognition.every((i) => known.includes(i.entryId))).toBe(true);
    const share = recognition.length / picks.filter((i) => known.includes(i.entryId)).length;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.3);
    expect(run(0, 1).some((i) => i.exerciseId.endsWith('-mc'))).toBe(false);
  });

  it('keeps a recognition exercise about several entries out until all of them are known', () => {
    const pairs: SessionExercise = { id: 'pairs', type: 'match-pairs', entryIds: ['p/e0', 'p/e1'] };
    const only = buildSession({
      entries: [{ id: 'p/e0' }],
      exercises: [pairs],
      srs: { 'p/e0': cardDue('2026-11-10') },
      today,
      newAllowed: 0,
      isProduction: () => false,
      mode: 'review',
    });
    expect(only).toEqual([]);
  });
});

describe('requeue', () => {
  const queue = ['a', 'b', 'c', 'd', 'e', 'f'].map((e) => ({ exerciseId: `${e}-x`, entryId: e, skill: 'written' as const, early: false, attempt: 1 }));

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

describe('listening in a review', () => {
  const listening: SessionExercise[] = ids.map((id) => ({ id: `${id}-l`, type: 'dictee-trous', entryIds: [id] }));
  const skillOf = (type: string) => (type === 'dictee-trous' ? 'listening' : 'written');
  const rule: OtherSkill = { skill: 'listening', requires: 'written', newAllowed: 5, share: 0.3 };
  const build = (srs: Record<string, SrsCard>, extra: Partial<Parameters<typeof buildSession>[0]> = {}) =>
    buildSession({ entries, exercises: [...exercises, ...listening], srs, today, newAllowed: 5, isProduction, skillOf, otherSkills: [rule], mode: 'review', rng: seeded(), ...extra });

  it('only hears entries already met in writing, within its own daily limit', () => {
    const srs = Object.fromEntries(ids.slice(0, 8).map((id) => [id, cardDue('2026-11-20')]));
    const heard = build(srs).filter((i) => i.skill === 'listening');
    expect(heard.map((i) => i.entryId)).toEqual(ids.slice(0, 5));
    expect(heard.every((i) => i.exerciseId.endsWith('-l'))).toBe(true);
  });

  it('takes at most its share of the session, due listening cards first', () => {
    const srs: Record<string, SrsCard> = {};
    for (const id of ids) {
      srs[id] = cardDue('2026-11-01');
      srs[`${id}#listening`] = cardDue('2026-11-02');
    }
    const items = build(srs);
    expect(items).toHaveLength(18);
    expect(items.filter((i) => i.skill === 'listening')).toHaveLength(5);
    expect(items.filter((i) => i.skill === 'written')).toHaveLength(13);
  });

  it('spreads listening through the session rather than bunching it', () => {
    const srs = Object.fromEntries(ids.map((id) => [id, cardDue('2026-11-01')]));
    const positions = build(srs)
      .map((item, i) => (item.skill === 'listening' ? i : -1))
      .filter((i) => i >= 0);
    expect(positions).toEqual([1, 5, 9, 12, 16]);
  });

  it('leaves listening out without the rule (quiet mode) and never schedules the written card from it', () => {
    const srs = Object.fromEntries(ids.map((id) => [id, cardDue('2026-11-01')]));
    expect(build(srs, { otherSkills: [] }).every((i) => i.skill === 'written' && !i.exerciseId.endsWith('-l'))).toBe(true);
  });
});

describe('interleave', () => {
  it('keeps both orders and places the others evenly', () => {
    expect(interleave(['a', 'b', 'c', 'd'], ['X', 'Y'])).toEqual(['a', 'X', 'b', 'c', 'Y', 'd']);
    expect(interleave([], ['X'])).toEqual(['X']);
    expect(interleave(['a'], [])).toEqual(['a']);
  });
});
