import { describe, expect, it } from 'vitest';
import { buildPairSet } from './answer';
import { checkDictation } from './dictation';

const kinds = (given: string, expected: string, pairs = new Set<string>()) =>
  checkDictation(given, expected, pairs).parts.map((p) => `${p.kind}:${p.expected ?? ''}/${p.given ?? ''}`);

describe('checkDictation', () => {
  it('passes an exact copy, ignoring case and punctuation', () => {
    expect(checkDictation("tu veux du cafe ou du the", "Tu veux du café ou du thé ?")).toMatchObject({ correct: true, nearMiss: true });
    expect(checkDictation("Tu veux du café, ou du thé", "Tu veux du café ou du thé ?")).toMatchObject({ correct: true, nearMiss: false });
    expect(checkDictation("j’habite à paris", "J'habite à Paris.")).toMatchObject({ correct: true, nearMiss: false });
  });

  it('marks a missing accent as a near miss, unless it makes another word', () => {
    expect(kinds('Je vais a Paris', 'Je vais à Paris.')).toEqual(['ok:Je/Je', 'ok:vais/vais', 'accent:à/a', 'ok:Paris/Paris']);
    const pairs = buildPairSet([['ou', 'où']]);
    const check = checkDictation('Tu habites ou ?', 'Tu habites où ?', pairs);
    expect(check.correct).toBe(false);
    expect(check.parts[2]).toEqual({ kind: 'wrong', expected: 'où', given: 'ou' });
  });

  it('reports missing, extra and misheard words in place', () => {
    expect(kinds('Je suis content', 'Je suis très content.')).toEqual(['ok:Je/Je', 'ok:suis/suis', 'missing:très/', 'ok:content/content']);
    expect(kinds('Je suis très très content', 'Je suis très content.')).toEqual([
      'ok:Je/Je',
      'ok:suis/suis',
      'ok:très/très',
      'extra:/très',
      'ok:content/content',
    ]);
    expect(kinds('Je fais les courses', "J'ai fait les courses.")).toEqual(['wrong:J\'ai/Je', 'wrong:fait/fais', 'ok:les/les', 'ok:courses/courses']);
  });

  it('fails swapped words: one is missing where it was said and extra where it was typed', () => {
    const check = checkDictation('Il pleut aujourd’hui beaucoup', "Il pleut beaucoup aujourd'hui.");
    expect(check.correct).toBe(false);
    expect(check.parts.map((p) => p.kind).sort()).toEqual(['extra', 'missing', 'ok', 'ok', 'ok']);
  });

  it('fails an empty answer', () => {
    expect(checkDictation('', 'Bonjour.')).toMatchObject({ correct: false, parts: [{ kind: 'missing', expected: 'Bonjour' }] });
  });
});
