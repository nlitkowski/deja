import { describe, expect, it } from 'vitest';
import { autoBossGroups, bossAnswer, buildBossQuestions, startBoss, type BossGroup } from './boss';

const sentence = (entryId: string, n: number, answer: string) => ({
  exerciseId: `${entryId}-${n}`,
  entryId,
  sentence: n % 2 ? `___ test ${n}.` : `Un test ___ ${n}.`,
  answers: [n % 2 ? answer.charAt(0).toUpperCase() + answer.slice(1) : answer],
});

const group = (ids: string[]): BossGroup => ({
  entryIds: ids,
  labels: Object.fromEntries(ids.map((id) => [id, id])),
  sentences: Object.fromEntries(ids.map((id) => [id, [0, 1, 2].map((n) => sentence(id, n, id))])),
});

function seeded(seed = 7) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

describe('buildBossQuestions', () => {
  it('takes groups and their entries in turn, mixing choices and typed answers', () => {
    const questions = buildBossQuestions([group(['dans', 'en']), group(['si'])], 10, seeded());
    expect(questions).toHaveLength(10);
    expect(questions.slice(0, 4).map((q) => q.entryId)).toEqual(['dans', 'si', 'en', 'si']);
    expect(questions.filter((q) => q.entryId === 'si').every((q) => q.kind === 'typed')).toBe(true);
    const choices = questions.filter((q) => q.kind === 'choice');
    expect(choices.length).toBeGreaterThan(0);
    for (const q of choices) {
      expect(q.options![0]).toBe(q.answers[0]);
      // A sentence-initial gap capitalises every choice.
      if (q.sentence.startsWith('___')) expect(q.options!.every((o) => /^[A-Z]/.test(o))).toBe(true);
    }
  });

  it('does not repeat a sentence of an entry that sits in two groups until its sentences run out', () => {
    const questions = buildBossQuestions([group(['a', 'b']), group(['b'])], 6, seeded());
    const ofB = questions.filter((q) => q.entryId === 'b').map((q) => q.exerciseId);
    expect(new Set(ofB.slice(0, 3)).size).toBe(3);
  });

  it('reuses sentences when there are fewer than questions, and gives nothing without sentences', () => {
    expect(buildBossQuestions([group(['dans'])], 7, seeded())).toHaveLength(7);
    expect(buildBossQuestions([{ entryIds: ['x'], labels: {}, sentences: {} }], 5, seeded())).toEqual([]);
  });
});

describe('autoBossGroups', () => {
  it('groups each entry with its confusables from the unit and skips groups already covered', () => {
    const groups = autoBossGroups([
      { id: 'car', confusables: ['parce-que', 'comme'] },
      { id: 'parce-que', confusables: ['car'] },
      { id: 'si', confusables: ['quand', 'other-pack/x'] },
      { id: 'et', confusables: [] },
    ]);
    expect(groups).toEqual([['car', 'parce-que'], ['si'], ['et']]);
  });
});

describe('bossAnswer', () => {
  it('loses a life per mistake and ends when lives run out', () => {
    let run = startBoss(2);
    run = bossAnswer(run, false, 10);
    expect(run).toEqual({ index: 1, lives: 1, correct: 0, mistakes: 1 });
    run = bossAnswer(run, false, 10);
    expect(run).toMatchObject({ lives: 0, defeated: false });
  });

  it('is won by reaching the last question with lives left', () => {
    let run = startBoss(3);
    for (let i = 0; i < 3; i++) run = bossAnswer(run, i !== 1, 3);
    expect(run).toEqual({ index: 3, lives: 2, correct: 2, mistakes: 1, defeated: true });
  });
});
