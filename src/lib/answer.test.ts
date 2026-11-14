import { describe, expect, it } from 'vitest';
import { checkAnswer, normalize } from './answer';

const pairs = [
  ['ou', 'où'],
  ['a', 'à'],
] as const;

describe('normalize', () => {
  it('ignores case, outer spaces, curly apostrophes and trailing punctuation', () => {
    expect(normalize('  Parce   QU’ ')).toBe("parce qu'");
    expect(normalize('Je ne sais pas ?')).toBe('je ne sais pas');
  });
});

describe('checkAnswer', () => {
  it('accepts an exact answer', () => {
    expect(checkAnswer('dans', ['dans'])).toMatchObject({ correct: true, nearMiss: false });
  });

  it('accepts any of several answers and reports the matched one', () => {
    expect(checkAnswer('car', ['parce que', 'car'])).toMatchObject({ correct: true, expected: 'car' });
  });

  it('treats a missing accent as a near miss', () => {
    expect(checkAnswer('derriere', ['derrière'], pairs)).toMatchObject({ correct: true, nearMiss: true });
    expect(checkAnswer('a cote de', ['à côté de'], pairs)).toMatchObject({ correct: false });
    expect(checkAnswer('pres de', ['près de'], pairs)).toMatchObject({ correct: true, nearMiss: true });
  });

  it('rejects ou for où because the accent changes the word', () => {
    expect(checkAnswer('ou', ['où'], pairs)).toMatchObject({ correct: false, nearMiss: false });
    expect(checkAnswer('où', ['ou'], pairs)).toMatchObject({ correct: false });
  });

  it('rejects a for à because the accent changes the word', () => {
    expect(checkAnswer('a', ['à'], pairs)).toMatchObject({ correct: false });
    expect(checkAnswer('A', ['à'], pairs).correct).toBe(false);
  });

  it('applies accent pairs per word inside longer answers', () => {
    expect(checkAnswer('a pied', ['à pied'], pairs).correct).toBe(false);
  });

  it('treats elision by the answers list', () => {
    expect(checkAnswer('parce qu’', ["parce qu'"])).toMatchObject({ correct: true, nearMiss: false });
    expect(checkAnswer('parce que', ["parce qu'"]).correct).toBe(false);
    expect(checkAnswer("s' il", ["s'il"]).correct).toBe(true);
  });

  it('treats the œ ligature and oe as the same', () => {
    expect(checkAnswer('oeufs', ['œufs'])).toMatchObject({ correct: true, nearMiss: false });
    expect(checkAnswer('sœur', ['soeur'])).toMatchObject({ correct: true, nearMiss: false });
  });

  it('rejects empty input', () => {
    expect(checkAnswer('   ', ['et'])).toMatchObject({ correct: false, expected: 'et' });
  });
});
