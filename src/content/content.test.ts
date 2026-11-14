import { describe, expect, it } from 'vitest';
import { exerciseTypeInfo, supportsHelpLang } from '../exercises/registry';
import { loadPacks } from './loader';
import { content, contentFiles } from './registry';

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
    for (const ex of disk.exercises.values()) ex.entryIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    const thin = [...disk.entries.keys()].filter((id) => (counts.get(id) ?? 0) < (isVocabulary(id) ? 2 : 3));
    expect(thin).toEqual([]);
  });

  it('French sentences keep the space before ? and !', () => {
    const bad: string[] = [];
    for (const ex of disk.exercises.values()) {
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
    for (const ex of disk.exercises.values()) {
      const data = ex.data as { hint?: { fr?: string } };
      if (data.hint && !data.hint.fr) missing.push(`${ex.id}: hint.fr`);
    }
    expect(missing).toEqual([]);
  });

  it('answers are not repeated next to the gap', () => {
    const bad: string[] = [];
    for (const ex of disk.exercises.values()) {
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
      [...disk.exercises.values()].filter((ex) => supportsHelpLang(ex.type, 'fr')).flatMap((ex) => ex.entryIds),
    );
    expect([...disk.entries.keys()].filter((id) => !covered.has(id))).toEqual([]);
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

  it('requires a production exercise per entry', () => {
    const { issues } = load({ id: 'u', title: 'U', icon: 'x', entries: [entry], exercises: [] });
    expect(issues).toContainEqual(expect.objectContaining({ path: 'p/e' }));
  });

  it('makes ids global', () => {
    const loaded = load({ id: 'u', title: 'U', icon: 'x', entries: [entry], exercises: [exercise] });
    expect(loaded.issues).toEqual([]);
    expect(loaded.exercises.get('p/x')?.entryIds).toEqual(['p/e']);
  });
});
