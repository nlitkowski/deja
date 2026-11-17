import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import audioConfig from '../../content/_audio/config.json';
import manifest from '../../content/_audio/manifest.json';
import { audioKey, voiceFor, type AudioConfig, type Manifest } from '../audio/manifest';
import { collectAudioTexts } from '../audio/texts';
import { buildBoss } from '../bosses';
import { exerciseTypeInfo, isProduction, supportsHelpLang } from '../exercises/registry';
import { mapState } from '../game/map';
import { loadPacks } from './loader';
import { content, contentFiles } from './registry';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const formatIssues = (issues: { file: string; path: string; message: string }[]) =>
  issues.map((i) => `${i.file} › ${i.path}: ${i.message}`).join('\n');

/** Every unit and sheet file on disk, as if each pack.json listed them all — validates work not yet wired into a pack. */
function loadFromDisk() {
  const listed = (kind: 'units' | 'sheets', packDir: string) =>
    Object.keys(contentFiles[kind])
      .filter((f) => f.startsWith(`/content/${packDir}/${kind}/`))
      .map((f) => f.split('/').pop()!.replace(/\.json$/, ''))
      .sort();
  const packs = Object.fromEntries(
    Object.entries(contentFiles.packs).map(([file, json]) => {
      const dir = file.split('/')[2]!;
      return [file, { ...(json as object), units: listed('units', dir), sheets: listed('sheets', dir) }];
    }),
  );
  return loadPacks({ ...contentFiles, packs }, exerciseTypeInfo);
}

const disk = loadFromDisk();
/** Content checks look at what authors wrote; generated exercises are tested on their own below. */
const written = [...disk.exercises.values()].filter((ex) => !ex.generated);
/** Deprecated entries are no longer practised, so they need no exercises. */
const activeEntryIds = [...disk.entries.values()].filter((e) => !e.deprecated).map((e) => e.id);
const isVocabulary = (entryId: string) => disk.entries.get(entryId)?.tags?.includes('vocabulaire') ?? false;

describe('content packs', () => {
  it('all content files on disk are valid', () => {
    expect(formatIssues(disk.issues)).toBe('');
    expect(disk.packs.length).toBeGreaterThan(0);
  });

  it('pack.json lists every unit and sheet file on disk', () => {
    const missing = disk.packs.flatMap((p) => {
      const manifest = content.packs.find((m) => m.id === p.id);
      return [
        ...p.units.filter((u) => !manifest?.units.includes(u)).map((u) => `${p.id}/units/${u}`),
        ...p.sheets.filter((s) => !manifest?.sheets.includes(s)).map((s) => `${p.id}/sheets/${s}`),
      ];
    });
    expect(missing).toEqual([]);
    expect(formatIssues(content.issues)).toBe('');
  });

  it('every grammar entry has at least 3 exercises, every vocabulary entry at least 2', () => {
    const counts = new Map<string, number>();
    for (const ex of written) ex.entryIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    const thin = activeEntryIds.filter((id) => (counts.get(id) ?? 0) < (isVocabulary(id) ? 2 : 3));
    expect(thin).toEqual([]);
  });

  it('every Édito entry has 3 production exercises, one of them a translation', () => {
    const production = new Map<string, number>();
    const translated = new Set<string>();
    for (const ex of written) {
      if (!isProduction(ex.type)) continue;
      for (const id of ex.entryIds) {
        production.set(id, (production.get(id) ?? 0) + 1);
        if (ex.type === 'translate-pl-fr') translated.add(id);
      }
    }
    const thin = activeEntryIds
      .filter((id) => id.startsWith('edito-'))
      .filter((id) => (production.get(id) ?? 0) < 3 || !translated.has(id));
    expect(thin).toEqual([]);
  });

  it('French sentences keep the space before ? and !', () => {
    const bad: string[] = [];
    for (const ex of written) {
      const sentence = (ex.data as { sentence?: string }).sentence;
      if (sentence && /\S[?!]/.test(sentence)) bad.push(ex.id);
    }
    expect(bad).toEqual([]);
  });

  it('every help text has a French version', () => {
    const missing: string[] = [];
    for (const e of disk.entries.values()) {
      if (!e.def) missing.push(`${e.id}: def`);
      if (e.tip && !e.tip.fr) missing.push(`${e.id}: tip.fr`);
    }
    for (const ex of written) {
      const data = ex.data as { hint?: { fr?: string } };
      if (data.hint && !data.hint.fr) missing.push(`${ex.id}: hint.fr`);
    }
    expect(missing).toEqual([]);
  });

  it('answers are not repeated next to the gap', () => {
    const bad: string[] = [];
    for (const ex of written) {
      const data = ex.data as { sentence?: string; answers: string[] };
      if (!data.sentence) continue;
      const [before = '', after = ''] = data.sentence.toLowerCase().split('___');
      const lastBefore = before.trim().split(/\s+/).pop() ?? '';
      const firstAfter = after.trim().split(/\s+/)[0] ?? '';
      if (data.answers.some((a) => a.toLowerCase() === lastBefore || a.toLowerCase() === firstAfter)) bad.push(ex.id);
    }
    expect(bad).toEqual([]);
  });

  it('sheet files have French help texts and French typography', () => {
    const problems: string[] = [];
    const visit = (value: unknown, path: string) => {
      if (Array.isArray(value)) return value.forEach((v, i) => visit(v, `${path}.${i}`));
      if (!value || typeof value !== 'object') return;
      const obj = value as Record<string, unknown>;
      if (typeof obj.pl === 'string' && !('fr' in obj) && !path.includes('items')) problems.push(`${path}: brak wersji fr`);
      if (typeof obj.fr === 'string' && /\S[?!;]/.test(obj.fr)) problems.push(`${path}.fr: brak spacji przed ? ! ;`);
      for (const [k, v] of Object.entries(obj)) visit(v, `${path}.${k}`);
    };
    for (const [file, json] of Object.entries(contentFiles.sheets)) visit(json, file);
    expect(problems).toEqual([]);
  });

  it('every entry can be practised with French help', () => {
    const covered = new Set(
      written.filter((ex) => supportsHelpLang(ex.type, 'fr')).flatMap((ex) => ex.entryIds),
    );
    expect(activeEntryIds.filter((id) => !covered.has(id))).toEqual([]);
  });

  it('every unit has a playable boss: full length, and choices wherever a group has two entries', () => {
    const problems: string[] = [];
    for (const unit of content.units.values()) {
      const boss = buildBoss(unit.key, () => 0.25);
      const expected = unit.boss?.questions ?? 10;
      if (boss?.questions.length !== expected) problems.push(`${unit.key}: ${boss?.questions.length ?? 0}/${expected} pytań`);
      const pairs = unit.boss?.groups.some((g) => g.length > 1);
      if (pairs && !boss?.questions.some((q) => q.kind === 'choice')) problems.push(`${unit.key}: brak pytań z wyborem`);
    }
    expect(problems).toEqual([]);
  });

  it('warns about oversized units (over 25 active entries or 110 exercises)', () => {
    const oversized = disk.packs.flatMap((p) =>
      p.unitList.flatMap((u) => {
        const active = u.entryIds.filter((id) => !disk.entries.get(id)?.deprecated).length;
        const exercises = u.exerciseIds.length;
        return active > 25 || exercises > 110 ? [`${u.key}: ${active} wpisów, ${exercises} ćwiczeń`] : [];
      }),
    );
    if (oversized.length) console.warn(['Za duże jednostki (cel: do 25 wpisów i 110 ćwiczeń):', ...oversized].join('\n'));
  });

  it('Édito A1 units have 60–110 exercises', () => {
    const edito = disk.packs.find((p) => p.id === 'edito-a1')!;
    const outside = edito.unitList.filter((u) => u.exerciseIds.length < 60 || u.exerciseIds.length > 110).map((u) => `${u.key}: ${u.exerciseIds.length}`);
    expect(outside).toEqual([]);
  });

  it('no text is double-encoded UTF-8 (’ read as â€™)', () => {
    const files = { ...contentFiles.packs, ...contentFiles.units, ...contentFiles.sheets, '/content/_audio/manifest.json': manifest };
    const broken = Object.entries(files)
      .filter(([, json]) => /â[\u0080-\u009f]|â€/.test(JSON.stringify(json)))
      .map(([file]) => file);
    expect(broken).toEqual([]);
  });

  it('a pack has no two active vocabulary entries for the same word', () => {
    const word = (fr: string) =>
      fr
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[’']/g, "'")
        .replace(/^(le|la|les|un|une|des|du|de la|l')\s*/, '')
        .trim();
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const e of disk.entries.values()) {
      if (e.deprecated || !isVocabulary(e.id)) continue;
      const key = `${e.packId}:${word(e.fr)}`;
      const other = seen.get(key);
      if (other) duplicates.push(`${other} = ${e.id}`);
      else seen.set(key, e.id);
    }
    expect(duplicates).toEqual([]);
  });

  it('every icon is a single character, without ZWJ sequences or variation selectors (they break in 8-bit)', () => {
    const icons = [
      ...disk.packs.map((p) => [p.id, p.icon]),
      ...disk.packs.flatMap((p) => p.unitList.map((u) => [u.key, u.icon])),
      ...[...disk.sheets.values()].map((s) => [s.key, s.icon]),
    ];
    const graphemes = (s: string) => [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(s)].length;
    const broken = icons.filter(([, icon]) => graphemes(icon!) !== 1 || icon!.includes('\u200d') || icon!.includes('\ufe0f')).map(([key, icon]) => `${key}: ${icon}`);
    expect(broken).toEqual([]);
  });

  it('Édito A1 unité 0 is optional: unité 1 stays open without it', () => {
    const edito = content.packs.find((p) => p.id === 'edito-a1')!;
    const packs = [{ id: edito.id, requires: [], units: edito.unitList.map((u) => ({ key: u.key, optional: u.optional, entryIds: u.entryIds })) }];
    const units = mapState(packs, {}, new Set()).get('edito-a1')!.units;
    expect(units.slice(0, 3).map((u) => [u.key, u.locked])).toEqual([
      ['edito-a1/unite-00', false],
      ['edito-a1/unite-01', false],
      ['edito-a1/unite-02', true],
    ]);
  });

  it('the template pack is valid', () => {
    const template = loadPacks(
      {
        packs: import.meta.glob('/content/_template/pack.json', { eager: true, import: 'default' }),
        units: import.meta.glob('/content/_template/units/*.json', { eager: true, import: 'default' }),
        sheets: import.meta.glob('/content/_template/sheets/*.json', { eager: true, import: 'default' }),
      },
      exerciseTypeInfo,
    );
    expect(formatIssues(template.issues)).toBe('');
  });
});

describe('loadPacks', () => {
  const pack = { id: 'p', version: 1, title: 'P', level: 'A1', icon: 'x', units: ['u'] };
  const entry = { id: 'e', fr: 'f', pl: 'p', examples: [{ fr: 'f', pl: 'p' }] };
  const exercise = { id: 'x', type: 'gap-fill', entryIds: ['e'], data: { sentence: 'a ___ b', answers: ['c'] } };
  const load = (unit: unknown, manifest: unknown = pack) =>
    loadPacks({ packs: { '/content/p/pack.json': manifest }, units: { '/content/p/units/u.json': unit } }, exerciseTypeInfo);

  it('reports the file and field path of invalid data', () => {
    const { issues } = load({ id: 'u', title: 'U', icon: 'x', entries: [entry], exercises: [{ ...exercise, data: { sentence: 'no gap', answers: ['c'] } }] });
    expect(issues).toContainEqual(expect.objectContaining({ file: '/content/p/units/u.json', path: 'exercises.0.data.sentence' }));
  });

  it('reports unknown references and exercise types', () => {
    const { issues } = load({
      id: 'u',
      title: 'U',
      icon: 'x',
      entries: [{ ...entry, confusables: ['other/missing'] }],
      exercises: [exercise, { ...exercise, id: 'y', type: 'nope' }],
    });
    expect(issues.map((i) => i.message).join('\n')).toMatch(/other\/missing/);
    expect(issues.map((i) => i.message).join('\n')).toMatch(/nieznany typ/);
  });

  it('reports boss groups that name unknown entries', () => {
    const { issues } = load({ id: 'u', title: 'U', icon: 'x', entries: [entry], exercises: [exercise], boss: { groups: [['e', 'nope']] } });
    expect(issues).toContainEqual(expect.objectContaining({ path: 'boss.groups.0.1' }));
  });

  it('requires a production exercise per entry', () => {
    const { issues } = load({ id: 'u', title: 'U', icon: 'x', entries: [entry], exercises: [] });
    expect(issues).toContainEqual(expect.objectContaining({ path: 'p/e' }));
  });

  it('validates replacedBy: only on deprecated entries, pointing at an active one', () => {
    const merged = { ...entry, id: 'm' };
    const ok = load({ id: 'u', title: 'U', icon: 'x', entries: [entry, { ...merged, deprecated: true, replacedBy: 'e' }], exercises: [exercise] });
    expect(ok.issues).toEqual([]);
    expect(ok.aliases.get('p/m')).toBe('p/e');
    const active = load({ id: 'u', title: 'U', icon: 'x', entries: [entry, { ...merged, replacedBy: 'e' }], exercises: [exercise, { ...exercise, id: 'y', entryIds: ['m'] }] });
    expect(active.issues).toContainEqual(expect.objectContaining({ path: 'entries.1.replacedBy' }));
    const toOld = load({ id: 'u', title: 'U', icon: 'x', entries: [entry, { ...merged, deprecated: true, replacedBy: 'm' }], exercises: [exercise] });
    expect(toOld.issues).toContainEqual(expect.objectContaining({ path: 'p/m' }));
  });

  it('keeps the types of retired exercises', () => {
    const loaded = load({ id: 'u', title: 'U', icon: 'x', entries: [entry], exercises: [exercise], retiredExercises: { 'translate-pl-fr': ['old'] } });
    expect(loaded.retiredExercises.get('p/old')).toBe('translate-pl-fr');
    const clash = load({ id: 'u', title: 'U', icon: 'x', entries: [entry], exercises: [exercise], retiredExercises: { 'gap-fill': ['x'] } });
    expect(clash.issues).toContainEqual(expect.objectContaining({ path: 'p/x' }));
  });

  it('makes ids global', () => {
    const loaded = load({ id: 'u', title: 'U', icon: 'x', entries: [entry], exercises: [exercise] });
    expect(loaded.issues).toEqual([]);
    expect(loaded.exercises.get('p/x')?.entryIds).toEqual(['p/e']);
  });
});

describe('generated exercises', () => {
  const pack = { id: 'p', version: 1, title: 'P', level: 'A1', icon: 'x', units: ['u'] };
  const entry = (id: string, confusables: string[] = []) => ({ id, fr: `fr-${id}`, pl: `pl-${id}`, examples: [{ fr: 'f', pl: 'p' }], confusables });
  const gap = (id: string, entryId: string, sentence: string, answers: string[]) => ({ id, type: 'gap-fill', entryIds: [entryId], data: { sentence, answers } });
  const unit = {
    id: 'u',
    title: 'U',
    icon: 'x',
    entries: [entry('dans', ['en', 'pendant']), entry('en', ['dans']), entry('pendant'), entry('depuis'), entry('sur')],
    exercises: [
      gap('dans-1', 'dans', 'Il part ___ cinq minutes.', ['dans']),
      gap('dans-2', 'dans', '___ la boîte, il y a un chat.', ['Dans']),
      gap('en-1', 'en', 'Je voyage ___ train.', ['en']),
      gap('en-2', 'en', "J'habite ___ France.", ['en']),
      gap('pendant-1', 'pendant', "J'ai dormi ___ deux heures.", ['pendant']),
      gap('depuis-1', 'depuis', "J'habite ici ___ 2020.", ['depuis', 'dès']),
      gap('sur-1', 'sur', 'Le livre est ___ la table.', ['sur']),
    ],
  };
  const loaded = loadPacks({ packs: { '/content/p/pack.json': pack }, units: { '/content/p/units/u.json': unit } }, exerciseTypeInfo);
  const generated = (type: string, entryId: string) =>
    [...loaded.exercises.values()].filter((ex) => ex.generated && ex.type === type && ex.id.startsWith(`p/${entryId}~`));

  it('multiple choice: confusables first, capitals follow the gap, accepted answers never offered as wrong', () => {
    expect(loaded.issues).toEqual([]);
    const [first, second] = generated('multiple-choice', 'dans');
    expect(first?.data).toMatchObject({ answer: 'dans', options: ['dans', 'en', 'pendant', 'depuis'] });
    expect(second?.data).toMatchObject({ answer: 'Dans', options: ['Dans', 'En', 'Pendant', 'Depuis'] });
    const depuis = generated('multiple-choice', 'depuis')[0]?.data as { options: string[] };
    expect(depuis.options).not.toContain('dès');
  });

  it('confusable duel: the entry against its confusables, sentences taken in turn', () => {
    const [duel] = generated('confusable-duel', 'dans');
    expect(duel?.entryIds).toEqual(['p/dans', 'p/en', 'p/pendant']);
    const data = duel?.data as { sentences: { entryId: string; options: string[] }[] };
    expect(data.sentences.map((s) => s.entryId)).toEqual(['p/dans', 'p/en', 'p/pendant', 'p/dans', 'p/en']);
    expect(data.sentences[0]?.options).toEqual(['dans', 'en', 'pendant']);
    expect(generated('confusable-duel', 'depuis')).toEqual([]);
  });

  it('match pairs: five entries of the unit, wrapping round', () => {
    const [pairs] = generated('match-pairs', 'depuis');
    expect(pairs?.entryIds).toEqual(['p/depuis', 'p/sur', 'p/dans', 'p/en', 'p/pendant']);
  });

  it('real content: every generated exercise is valid and recognition never stands alone', () => {
    const all = [...disk.exercises.values()].filter((ex) => ex.generated);
    const byType = (type: string) => all.filter((ex) => ex.type === type).length;
    expect(byType('multiple-choice')).toBeGreaterThan(100);
    expect(byType('confusable-duel')).toBeGreaterThan(10);
    expect(byType('match-pairs')).toBeGreaterThan(50);
    const invalid = all.filter((ex) => !exerciseTypeInfo[ex.type]!.schema.safeParse(ex.data).success).map((ex) => ex.id);
    expect(invalid).toEqual([]);
    expect([...loadFromDisk().exercises.keys()]).toEqual([...disk.exercises.keys()]);
  });
});

describe('audio', () => {
  const config = audioConfig as AudioConfig;
  const recorded = manifest as Manifest;

  // Until voices are chosen there is nothing to record against; from then on every text needs its recording.
  it.skipIf(!config.voices.length)('has a recording in the manifest for every text (npm run tts)', () => {
    const missing = collectAudioTexts(content)
      .filter((t) => !recorded[audioKey(config.provider, voiceFor(config, t.text, sha256), t.text, sha256)])
      .map((t) => `${t.text}  ← ${t.sources[0]}`);
    expect(missing, `${missing.length} text(s) without a recording; run npm run tts and commit content/_audio/manifest.json`).toEqual([]);
  });
});
