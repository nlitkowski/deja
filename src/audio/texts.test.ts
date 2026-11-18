import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { loadPacks } from '../content/loader';
import { exerciseTypeInfo } from '../exercises/logic';
import { audioKey, audioKeyAsync, KEPT_HASH, voiceFor, type AudioConfig } from './manifest';
import { collectAudioTexts, exerciseAudioText, isSentence, normalizeText, spoken } from './texts';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function load(unit: object, sheet?: object) {
  return loadPacks(
    {
      packs: { '/content/p/pack.json': { id: 'p', version: 1, title: 'P', level: 'A1', icon: '🔗', units: ['u'], sheets: sheet ? ['s'] : [] } },
      units: { '/content/p/units/u.json': { id: 'u', title: 'U', icon: '🔗', ...unit } },
      sheets: sheet ? { '/content/p/sheets/s.json': { id: 's', title: 'S', icon: '📄', ...sheet } } : {},
    },
    exerciseTypeInfo,
  );
}

const entry = (id: string, extra: object = {}) => ({ id, fr: id, pl: id, examples: [{ fr: `Exemple ${id}.`, pl: 'x' }], ...extra });

describe('normalizeText', () => {
  it('ignores markup, apostrophe style and spacing', () => {
    expect(normalizeText("  **Puisque** tu  es là,\naide-moi ’ ")).toBe("Puisque tu es là, aide-moi '");
    expect(normalizeText('Tu viens ?')).toBe(normalizeText('Tu viens ?'));
    expect(normalizeText('é')).toBe(normalizeText('é'));
  });

  it('reads alternatives as a list and leaves asides out', () => {
    expect(spoken('avec / sans')).toBe('avec, sans');
    expect(spoken('Chère Julie, / Cher Marc,')).toBe('Chère Julie, Cher Marc,');
    expect(spoken('Nous ___ un chat. (avoir)')).toBe('Nous ___ un chat.');
  });
});

describe('isSentence', () => {
  it('takes whole sentences from tables, not labels or fragments', () => {
    expect(isSentence('**Puisque** tu es là, aide-moi.')).toBe(true);
    expect(isSentence('Tu viens ?')).toBe(true);
    expect(isSentence('cause connue')).toBe(false);
    expect(isSentence('**avant** le cours')).toBe(false);
    expect(isSentence('je / j\'')).toBe(false);
    expect(isSentence('Moi.')).toBe(false);
  });
});

describe('collectAudioTexts', () => {
  it('records entries, examples, filled gaps, first translations and sheet sentences once each', () => {
    const content = load(
      {
        entries: [entry('dans'), entry('en', { audio: { skip: true } })],
        exercises: [
          { id: 'g', type: 'gap-fill', entryIds: ['dans'], data: { sentence: 'Le chat est ___ la boîte.', answers: ['dans'] } },
          { id: 't', type: 'translate-pl-fr', entryIds: ['dans'], data: { pl: 'x', answers: ['Exemple dans.', 'autre'] } },
          { id: 'h', type: 'gap-fill', entryIds: ['en'], data: { sentence: "J'habite ___ France.", answers: ['en'] }, audio: { dictation: false } },
          { id: 's', type: 'gap-fill', entryIds: ['en'], data: { sentence: 'Elle va ___ Paris.', answers: ['à'] }, audio: { skip: true } },
        ],
      },
      {
        sections: [
          {
            kind: 'grammar',
            title: 'T',
            blocks: [
              { type: 'examples', items: [{ fr: 'Le chat est dans la boîte.', pl: 'x' }] },
              { type: 'words', items: [{ fr: 'un chat', pl: 'kot' }, { fr: 'le 1er mai', pl: 'x', audio: { text: 'le premier mai' } }] },
              { type: 'table', head: ['', 'exemple'], rows: [['cause', 'Il pleut, donc je reste.']] },
              { type: 'table', head: ['a'], rows: [['Je ne lis pas ce tableau.']], audio: { skip: true } },
            ],
          },
        ],
      },
    );
    expect(content.issues).toEqual([]);
    const texts = collectAudioTexts(content);
    expect(texts.map((t) => t.text).sort()).toEqual(
      ['dans', 'Exemple dans.', 'Exemple en.', 'Le chat est dans la boîte.', "J'habite en France.", 'un chat', 'le premier mai', 'Il pleut, donc je reste.'].sort(),
    );
    expect(texts.find((t) => t.text === 'Le chat est dans la boîte.')?.sources).toHaveLength(2);
    expect(texts.find((t) => t.text === "J'habite en France.")?.dictation).toBe(false);
    expect(texts.find((t) => t.text === 'dans')?.dictation).toBe(true);
  });

  it('skips generated exercises and deprecated entries', () => {
    const content = load({
      entries: [entry('a'), entry('b'), entry('old', { deprecated: true })],
      exercises: [
        { id: 'a1', type: 'gap-fill', entryIds: ['a'], data: { sentence: 'Phrase ___ un.', answers: ['a'] } },
        { id: 'b1', type: 'gap-fill', entryIds: ['b'], data: { sentence: 'Phrase ___ deux.', answers: ['b'] } },
        { id: 'o1', type: 'gap-fill', entryIds: ['old'], data: { sentence: 'Phrase ___ trois.', answers: ['old'] } },
      ],
    });
    const fake = { id: 'p/a~gap-fill-0', packId: 'p', unitId: 'u', type: 'gap-fill', entryIds: ['p/a'], generated: true, data: { sentence: 'Généré ___.', answers: ['a'] } };
    content.exercises.set(fake.id, fake);
    content.packs[0]!.unitList[0]!.exerciseIds.push(fake.id);
    const texts = collectAudioTexts(content).map((t) => t.text);
    expect(texts).not.toContain('old');
    expect(texts).not.toContain('Exemple old.');
    expect(texts.filter((t) => t.startsWith('Phrase'))).toHaveLength(3);
    expect(texts).not.toContain('Généré a.');
  });
});

describe('recording keys', () => {
  const config: AudioConfig = { provider: 'azure', lang: 'fr-FR', format: 'mp3', bucket: 'b', baseUrl: 'https://x', voices: ['f', 'm'] };

  it('give a sentence the same voice every time and use both voices', () => {
    const texts = Array.from({ length: 40 }, (_, i) => `Phrase ${i}.`);
    expect(texts.map((t) => voiceFor(config, t, sha256))).toEqual(texts.map((t) => voiceFor(config, t, sha256)));
    expect(new Set(texts.map((t) => voiceFor(config, t, sha256)))).toEqual(new Set(['f', 'm']));
  });

  it('change with the text, the voice or the provider', () => {
    const key = audioKey('azure', 'f', 'Bonjour.', sha256);
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(audioKey('azure', 'f', 'Bonjour !', sha256)).not.toBe(key);
    expect(audioKey('azure', 'm', 'Bonjour.', sha256)).not.toBe(key);
    expect(audioKey('google', 'f', 'Bonjour.', sha256)).not.toBe(key);
  });

  it('are the same when the browser computes them', async () => {
    const subtle = async (t: string) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t))).toString('hex');
    const withKept: AudioConfig = { ...config, kept: { voices: ['old'], texts: { [sha256('Bonjour.').slice(0, KEPT_HASH)]: 0 } } };
    for (const c of [config, withKept])
      for (const text of ['Bonjour.', "J'habite en France.", 'Tu veux du café ou du thé ?']) {
        expect(await audioKeyAsync(c, text, subtle)).toBe(audioKey(c.provider, voiceFor(c, text, sha256), text, sha256));
      }
  });

  it('keep the voice a text was recorded with after the voices change', () => {
    const kept: AudioConfig = { ...config, voices: ['n'], kept: { voices: ['f', 'm'], texts: { [sha256('Bonjour.').slice(0, KEPT_HASH)]: 1 } } };
    expect(voiceFor(kept, 'Bonjour.', sha256)).toBe('m');
    expect(voiceFor(kept, 'Salut.', sha256)).toBe('n');
  });
});

describe('exerciseAudioText', () => {
  it('reads the sentence an exercise practises, as recorded', () => {
    expect(exerciseAudioText({ type: 'gap-fill', data: { sentence: 'Je vais ___ cinéma. (à + le)', answers: ['au'] } })).toBe('Je vais au cinéma.');
    expect(exerciseAudioText({ type: 'translate-pl-fr', data: { pl: 'x', answers: ['Il pleut.', 'Ça pleut.'] } })).toBe('Il pleut.');
    expect(exerciseAudioText({ type: 'multiple-choice', data: { sentence: '___ tu veux, on y va.', answer: 'Si', options: [] } })).toBe('Si tu veux, on y va.');
    expect(exerciseAudioText({ type: 'gap-fill', data: { sentence: 'A ___.', answers: ['b'] }, audio: { skip: true } })).toBeUndefined();
    expect(exerciseAudioText({ type: 'match-pairs', data: {} })).toBeUndefined();
  });
});
