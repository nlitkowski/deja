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

  it('ignores commas, semicolons and colons inside the answer', () => {
    expect(checkAnswer('si tu es fatigué, va dormir', ['si tu es fatigué va dormir']).correct).toBe(true);
    expect(checkAnswer('si tu es fatigué va dormir', ['si tu es fatigué, va dormir']).correct).toBe(true);
  });

  it('accepts a negation without "ne", as it is spoken, and says how it is written', () => {
    const spoken = (given: string, expected: string) => checkAnswer(given, [expected]);
    expect(spoken("j'ai pas", "je n'ai pas")).toMatchObject({ correct: true, nearMiss: false, note: 'ne-dropped', expected: "je n'ai pas" });
    expect(spoken("c'est pas", "ce n'est pas").note).toBe('ne-dropped');
    expect(spoken('il y a personne', "il n'y a personne").correct).toBe(true);
    expect(spoken('y a personne', "il n'y a personne").correct).toBe(true);
    expect(spoken('je mange jamais', 'je ne mange jamais').correct).toBe(true);
    expect(spoken('personne est venu', "personne n'est venu").correct).toBe(true);
    expect(spoken("j'ai", "je n'ai pas").correct).toBe(false);
    expect(spoken('je ai pas', "je n'ai pas").correct).toBe(false);
    expect(checkAnswer("j'ai pas", ["je n'ai pas"], [], { colloquial: false }).correct).toBe(false);
  });

  it('rejects "parce-que" with a hyphen, with a note', () => {
    expect(checkAnswer('parce-que', ['parce que'])).toMatchObject({ correct: false, note: 'hyphen' });
    expect(checkAnswer("parce-qu'il", ["parce qu'il"])).toMatchObject({ correct: false, note: 'hyphen' });
  });

  it('accepts times and numbers in words or digits', () => {
    expect(checkAnswer('8h30', ['huit heures et demie']).correct).toBe(true);
    expect(checkAnswer('à 6 h', ['à six heures']).correct).toBe(true);
    expect(checkAnswer('à 6h', ['à 6 heures']).correct).toBe(true);
    expect(checkAnswer('9 h 15', ['neuf heures et quart']).correct).toBe(true);
    expect(checkAnswer('1h', ['une heure']).correct).toBe(true);
    expect(checkAnswer('22 euros', ['vingt-deux euros']).correct).toBe(true);
    expect(checkAnswer('71', ['soixante et onze']).correct).toBe(true);
    expect(checkAnswer('99', ['quatre-vingt-dix-neuf']).correct).toBe(true);
    expect(checkAnswer('80', ['quatre-vingts']).correct).toBe(true);
    expect(checkAnswer('nonante', ['quatre-vingt-dix']).correct).toBe(true);
    expect(checkAnswer('1', ['un']).correct).toBe(false);
  });

  it('rejects empty input', () => {
    expect(checkAnswer('   ', ['et'])).toMatchObject({ correct: false, expected: 'et' });
  });
});
