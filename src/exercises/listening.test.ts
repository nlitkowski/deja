import { describe, expect, it } from 'vitest';
import { collectAudioTexts } from '../audio/texts';
import { loadPacks } from '../content/loader';
import { content } from '../content/registry';
import { soundsAlike } from './paires-minimales/sound';
import { exerciseTypeInfo, skillOf } from './registry';

const pack = { id: 'p', version: 1, title: 'P', level: 'A1', icon: 'x', units: ['u'] };
const gap = (id: string, entryId: string, sentence: string, answers: string[], extra: object = {}) => ({
  id,
  type: 'gap-fill',
  entryIds: [entryId],
  data: { sentence, answers, pl: `pl ${id}` },
  ...extra,
});
const entry = (id: string, examples: object[] = [{ fr: `(${id})`, pl: `(${id})` }]) => ({ id, fr: id, pl: id, examples });

function load(exercises: object[], entries = [entry('a'), entry('b'), entry('c'), entry('d')]) {
  const unit = { id: 'u', title: 'U', icon: 'x', entries, exercises };
  return loadPacks({ packs: { '/content/p/pack.json': pack }, units: { '/content/p/units/u.json': unit } }, exerciseTypeInfo);
}

describe('listening exercises generated from content', () => {
  const exercises = [
    gap('a-1', 'a', 'Je vais ___ Paris.', ['à']),
    gap('a-skip', 'a', 'Je parle ___ Zoé.', ['à'], { audio: { skip: true } }),
    gap('a-same', 'a', 'Il ___ chante.', ['parle'], { audio: { dictation: false } }),
    gap('a-read', 'a', 'Le cours est ___ 8 heures.', ['à'], { audio: { text: 'Le cours est à huit heures.' } }),
    gap('a-long', 'a', 'Le matin, je vais ___ pied avec mon petit frère et ma sœur.', ['à']),
    gap('b-1', 'b', 'Le livre est ___ la table.', ['sur']),
    gap('c-1', 'c', 'Le chat dort ___ le lit.', ['sous']),
    gap('d-1', 'd', 'Je viens ___ Pologne.', ['de']),
  ];
  const entries = [entry('a', [{ fr: 'Je vais à Lyon.', pl: 'Jadę do Lyonu.' }]), entry('b'), entry('c'), entry('d')];
  const loaded = load(exercises, entries);
  const of = (type: string, entryId: string) => [...loaded.exercises.values()].filter((ex) => ex.type === type && ex.id.startsWith(`p/${entryId}~`));

  it('trains the listening card', () => {
    for (const type of ['dictee-trous', 'dictee', 'ecoute-sens', 'paires-minimales']) expect(skillOf(type)).toBe('listening');
  });

  it('dictée à trous: every recorded gap-fill heard as written, accepting only the word that was said', () => {
    expect(loaded.issues).toEqual([]);
    expect(of('dictee-trous', 'a').map((ex) => ex.data)).toEqual([
      { sentence: 'Je vais ___ Paris.', answer: 'à', audio: 'Je vais à Paris.' },
      { sentence: 'Le matin, je vais ___ pied avec mon petit frère et ma sœur.', answer: 'à', audio: 'Le matin, je vais à pied avec mon petit frère et ma sœur.' },
    ]);
  });

  it('dictée: short sentences from gap-fills and examples, never skipped, ambiguous or read differently', () => {
    expect(of('dictee', 'a').map((ex) => ex.data)).toEqual([
      { text: 'Je vais à Paris.', key: 'à' },
      { text: 'Je vais à Lyon.', key: 'a' },
    ]);
  });

  it('écoute-sens: Polish meanings of other entries of the unit as distractors, the same on every load', () => {
    const [first] = of('ecoute-sens', 'a');
    expect(first?.data).toMatchObject({ audio: 'Je vais à Paris.', answer: 'pl a-1' });
    const { options } = first!.data as { options: string[] };
    expect(options).toHaveLength(4);
    expect(new Set(options.slice(1))).toEqual(new Set(['pl b-1', 'pl c-1', 'pl d-1']));
    const again = [...load(exercises, entries).exercises.values()].filter((ex) => ex.type === 'ecoute-sens');
    expect(again.map((ex) => ex.data)).toEqual([...loaded.exercises.values()].filter((ex) => ex.type === 'ecoute-sens').map((ex) => ex.data));
  });
});

describe('paires minimales', () => {
  it('tells homophones from pairs that sound different', () => {
    for (const [a, b] of [
      ['ou', 'où'],
      ['Il a un chat.', 'Il à un chat.'],
      ['et', 'est'],
      ['ces livres', 'ses livres'],
      ['il parle', 'ils parlent'],
      ['je fais', 'je fait'],
      ['Elle mange.', 'Elles mangent.'],
    ]) {
      expect(soundsAlike(a!, b!), `${a} / ${b}`).toBe(true);
    }
    for (const [a, b] of [
      ['dessus', 'dessous'],
      ['le livre', 'les livres'],
      ['du pain', 'deux pains'],
      ['Je fais les courses.', "J'ai fait les courses."],
      ['Il a mangé.', 'Il va manger.'],
      ['Il mange.', 'Il a mangé.'],
      ['ce pull', 'ces pulls'],
    ]) {
      expect(soundsAlike(a!, b!), `${a} / ${b}`).toBe(false);
    }
  });

  it('a homophone pair fails pack validation', () => {
    const { issues } = load([gap('a-1', 'a', 'Je vais ___ Paris.', ['à']), { id: 'mp', type: 'paires-minimales', entryIds: ['a'], data: { pair: ['ou', 'où'] } }]);
    expect(issues).toContainEqual(expect.objectContaining({ file: '/content/p/units/u.json', path: 'exercises.1.data.pair' }));
  });

  it('both sides are recorded', () => {
    const loaded = load([gap('a-1', 'a', 'Je vais ___ Paris.', ['à']), { id: 'mp', type: 'paires-minimales', entryIds: ['a'], data: { pair: ['dessus', 'dessous'] } }]);
    const texts = collectAudioTexts(loaded).map((t) => t.text);
    expect(texts).toEqual(expect.arrayContaining(['dessus', 'dessous']));
  });

  it('real content has pairs in several units', () => {
    const units = new Set([...content.exercises.values()].filter((ex) => ex.type === 'paires-minimales').map((ex) => ex.unitId));
    expect(units.size).toBeGreaterThanOrEqual(5);
  });
});
