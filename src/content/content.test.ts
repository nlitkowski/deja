import { describe, expect, it } from 'vitest';
import { exerciseTypeInfo, supportsHelpLang } from '../exercises/registry';
import { loadPacks } from './loader';
import { content } from './registry';

const formatIssues = (issues: { file: string; path: string; message: string }[]) =>
  issues.map((i) => `${i.file} › ${i.path}: ${i.message}`).join('\n');

describe('content packs', () => {
  it('all packs are valid', () => {
    expect(formatIssues(content.issues)).toBe('');
    expect(content.packs.length).toBeGreaterThan(0);
  });

  it('every entry has at least 3 exercises', () => {
    const counts = new Map<string, number>();
    for (const ex of content.exercises.values()) ex.entryIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    const thin = [...content.entries.keys()].filter((id) => (counts.get(id) ?? 0) < 3);
    expect(thin).toEqual([]);
  });

  it('French sentences keep the space before ? and !', () => {
    const bad: string[] = [];
    for (const ex of content.exercises.values()) {
      const sentence = (ex.data as { sentence?: string }).sentence;
      if (sentence && /\S[?!]/.test(sentence)) bad.push(ex.id);
    }
    expect(bad).toEqual([]);
  });

  it('every help text has a French version', () => {
    const missing: string[] = [];
    for (const e of content.entries.values()) {
      if (!e.def) missing.push(`${e.id}: def`);
      if (e.tip && !e.tip.fr) missing.push(`${e.id}: tip.fr`);
    }
    for (const ex of content.exercises.values()) {
      const data = ex.data as { hint?: { fr?: string } };
      if (data.hint && !data.hint.fr) missing.push(`${ex.id}: hint.fr`);
    }
    expect(missing).toEqual([]);
  });

  it('every entry can be practised with French help', () => {
    const covered = new Set(
      [...content.exercises.values()].filter((ex) => supportsHelpLang(ex.type, 'fr')).flatMap((ex) => ex.entryIds),
    );
    expect([...content.entries.keys()].filter((id) => !covered.has(id))).toEqual([]);
  });

  it('the template pack is valid', () => {
    const template = loadPacks(
      {
        packs: import.meta.glob('/content/_template/pack.json', { eager: true, import: 'default' }),
        units: import.meta.glob('/content/_template/units/*.json', { eager: true, import: 'default' }),
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
