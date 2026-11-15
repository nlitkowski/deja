import { describe, expect, it } from 'vitest';
import { cardKey, gradeFromResult, isDue, review, skillOfKey } from './srs';

const base = { correct: true, nearMiss: false, timeMs: 8000, hintUsed: false };

describe('gradeFromResult', () => {
  it('maps answer results to grades', () => {
    expect(gradeFromResult({ ...base, correct: false })).toBe('again');
    expect(gradeFromResult({ ...base, nearMiss: true })).toBe('hard');
    expect(gradeFromResult({ ...base, hintUsed: true })).toBe('hard');
    expect(gradeFromResult(base)).toBe('good');
    expect(gradeFromResult({ ...base, timeMs: 2000 })).toBe('easy');
    expect(gradeFromResult({ ...base, correct: false, grade: 'easy' })).toBe('easy');
  });

  it('gives longer answers more time to count as easy', () => {
    expect(gradeFromResult({ ...base, timeMs: 4000, expected: 'en' })).toBe('easy');
    expect(gradeFromResult({ ...base, timeMs: 8000, expected: 'Je travaille ici depuis deux ans déjà...' })).toBe('easy');
    expect(gradeFromResult({ ...base, timeMs: 6000, expected: 'en' })).toBe('good');
    expect(gradeFromResult({ ...base, timeMs: 15000, expected: 'x'.repeat(200) })).toBe('good');
  });
});

describe('review', () => {
  const today = '2026-11-14';

  it('schedules a new card for tomorrow on good', () => {
    const card = review(undefined, 'good', today);
    expect(card).toMatchObject({ interval: 1, due: '2026-11-15', reps: 1, ease: 2.5, correctTotal: 1 });
  });

  it('grows the interval with consecutive good reviews', () => {
    let card = review(undefined, 'good', today);
    card = review(card, 'good', card.due);
    expect(card.interval).toBe(3);
    card = review(card, 'good', card.due);
    expect(card.interval).toBe(8);
  });

  it('keeps a failed card due today and resets the streak', () => {
    let card = review(undefined, 'good', today);
    card = review(card, 'good', card.due);
    card = review(card, 'again', '2026-11-18');
    expect(card).toMatchObject({ interval: 0, due: '2026-11-18', reps: 0, lapses: 1 });
    expect(card.ease).toBeCloseTo(2.3);
    expect(isDue(card, '2026-11-18')).toBe(true);
  });

  it('never lets ease drop below the minimum', () => {
    let card = review(undefined, 'again', today);
    for (let i = 0; i < 20; i++) card = review(card, 'again', today);
    expect(card.ease).toBe(1.3);
  });

  it('gives easy a longer interval than good and hard a shorter one', () => {
    const start = review(review(undefined, 'good', today), 'good', '2026-11-15');
    const day = start.due;
    const hard = review(start, 'hard', day).interval;
    const good = review(start, 'good', day).interval;
    const easy = review(start, 'easy', day).interval;
    expect(hard).toBeLessThan(good);
    expect(good).toBeLessThan(easy);
  });
});

describe('cardKey', () => {
  it('keys the written card by the bare entry id, so stored cards stay valid', () => {
    expect(cardKey('p/a')).toBe('p/a');
    expect(cardKey('p/a', 'written')).toBe('p/a');
  });
});

describe('cardKey for other skills', () => {
  it('suffixes the skill and reads it back', () => {
    expect(cardKey('p/a', 'listening')).toBe('p/a#listening');
    expect(skillOfKey(cardKey('p/a', 'speaking'))).toBe('speaking');
    expect(skillOfKey('p/a')).toBe('written');
  });
});
