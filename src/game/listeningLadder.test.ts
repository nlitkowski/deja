import { describe, expect, it } from 'vitest';
import { knownSentence, sentenceEntries } from '../audio/sentenceEntries';
import { loadPacks } from '../content/loader';
import { exerciseTypeInfo } from '../exercises/registry';
import { buildSession, requeue, type SessionExercise, type SessionItem } from '../lib/session';
import { review } from '../lib/srs';
import { climb, ladderPicker, ladderRetry, rungOf, stepOf } from './listeningLadder';

function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

const ex = (id: string, type: string, words = 0) => ({ id, type, entryIds: ['p/a'], words });
type Ex = ReturnType<typeof ex>;
const rung = (e: SessionExercise) => rungOf(e.type, (e as Ex).words);
const pool: Ex[] = [
  ex('sens', 'ecoute-sens'),
  ex('paire', 'paires-minimales'),
  ex('trous', 'dictee-trous'),
  ex('court', 'dictee', 4),
  ex('moyen', 'dictee', 7),
];
const draws = (top: number, n = 300, candidates: readonly Ex[] = pool) => {
  const rng = seeded(7);
  return Array.from({ length: n }, () => climb(candidates, top, rung, rng)?.id);
};
const failed = (exerciseId: string): SessionItem => ({ exerciseId, entryId: 'p/a', skill: 'listening', early: false, attempt: 1 });

describe('listening ladder', () => {
  it('places each type and dictation length on its rung', () => {
    expect([rungOf('ecoute-sens'), rungOf('paires-minimales'), rungOf('dictee-trous')]).toEqual([0, 0, 1]);
    expect([rungOf('dictee', 5), rungOf('dictee', 6), rungOf('dictee', 9), rungOf('gap-fill')]).toEqual([2, 3, -1, -1]);
    expect([0, 1, 2, 3, 5].map(stepOf)).toEqual([0, 1, 2, 3, 3]);
  });

  it('never gives a new listening card a dictation', () => {
    expect(new Set(draws(stepOf(0)))).toEqual(new Set(['sens', 'paire']));
  });

  it('gives a card on mastery 2 no dictation longer than five words', () => {
    const got = draws(stepOf(2));
    expect(got).not.toContain('moyen');
    expect(got).toContain('court');
  });

  it('draws the highest type most of the time from rung 2, the lower ones the rest', () => {
    const got = draws(stepOf(3), 1000);
    const share = got.filter((id) => id === 'court' || id === 'moyen').length / got.length;
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.7);
    expect(got).toContain('trous');
  });

  it('falls back to the nearest rung below, and leaves the card out when nothing fits', () => {
    expect(new Set(draws(3, 50, [pool[2]!, pool[0]!]))).toEqual(new Set(['trous', 'sens']));
    expect(climb([pool[3]!, pool[4]!], 1, rung, seeded())).toBeUndefined();
  });

  it('retries one rung lower after a mistake', () => {
    const retry = ladderRetry(rung);
    const rng = seeded(3);
    for (let i = 0; i < 50; i++) {
      expect(retry(pool, failed('court'), rng)?.id).toBe('trous');
      expect(['sens', 'paire']).toContain(retry(pool, failed('trous'), rng)?.id);
      expect(['sens', 'paire']).toContain(retry(pool, failed('sens'), rng)?.id);
    }
    const queue = requeue([failed('moyen')], 0, failed('moyen'), pool, () => true, seeded(), retry);
    expect(['court', 'trous']).toContain(queue[1]!.exerciseId);
  });

  it('lets a new listening card into a review through recognition when the ladder picks', () => {
    const written = review(undefined, 'good', '2026-11-01');
    const items = buildSession({
      entries: [{ id: 'p/a' }],
      exercises: pool,
      srs: { 'p/a': { ...written, due: '2026-12-31' } },
      today: '2026-11-14',
      newAllowed: 0,
      isProduction: (type) => type.startsWith('dictee'),
      skillOf: () => 'listening',
      otherSkills: [{ skill: 'listening', requires: 'written', newAllowed: 5, share: 0.5, pick: ladderPicker(() => 0, rung) }],
      mode: 'review',
      rng: seeded(),
    });
    expect(items).toHaveLength(1);
    expect(['sens', 'paire']).toContain(items[0]!.exerciseId);
  });
});

describe('full dictation from known words only', () => {
  const pack = { id: 'p', version: 1, title: 'P', level: 'A1', icon: 'x', units: ['u'] };
  const gap = (id: string, entryId: string, sentence: string, answer: string) => ({
    id,
    type: 'gap-fill',
    entryIds: [entryId],
    data: { sentence, answers: [answer], pl: id },
  });
  const entry = (id: string) => ({ id, fr: id, pl: id, examples: [{ fr: `(${id})`, pl: id }] });
  const unit = {
    id: 'u',
    title: 'U',
    icon: 'x',
    entries: [entry('a'), entry('b')],
    // One sentence, two gaps: "à" for a, "Paris" for b.
    exercises: [gap('a-1', 'a', 'Je vais ___ Paris.', 'à'), gap('b-1', 'b', 'Je vais à ___.', 'Paris'), gap('a-2', 'a', 'Il est ___ Lyon.', 'à')],
  };
  const content = loadPacks({ packs: { '/content/p/pack.json': pack }, units: { '/content/p/units/u.json': unit } }, exerciseTypeInfo);
  const index = sentenceEntries(content.exercises.values(), content.entries.values());

  it('leaves out a sentence that belongs to an entry not seen yet', () => {
    expect(index.get('Je vais à Paris.')).toEqual(new Set(['p/a', 'p/b']));
    expect(knownSentence('Je vais à Paris.', ['p/a'], index, () => false)).toBe(false);
    expect(knownSentence('Je vais à Paris.', ['p/a'], index, (id) => id === 'p/b')).toBe(true);
    expect(knownSentence('Il est à Lyon.', ['p/a'], index, () => false)).toBe(true);
  });

  it('keys a generated dictation on the word of its gap', () => {
    const dictees = [...content.exercises.values()].filter((e) => e.type === 'dictee' && e.entryIds[0] === 'p/a');
    expect(dictees.map((e) => e.data)).toContainEqual({ text: 'Je vais à Paris.', key: 'à' });
  });
});
