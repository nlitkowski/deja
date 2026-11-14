import type { ZodType } from 'zod';
import {
  PackSchema,
  UnitSchema,
  type Entry,
  type Exercise,
  type Pack,
  type PackManifest,
  type RawUnit,
  type Unit,
} from './schema';
import { SheetSchema, type Sheet } from './sheet';

export interface LoadIssue {
  file: string;
  path: string;
  message: string;
}

export interface ExerciseTypeInfo {
  schema: ZodType<unknown>;
  production: boolean;
}

/** Parsed JSON keyed by path: `/content/<pack>/pack.json`, `/content/<pack>/units/<unit>.json`, `/content/<pack>/sheets/<sheet>.json`. */
export interface ContentFiles {
  packs: Record<string, unknown>;
  units: Record<string, unknown>;
  sheets?: Record<string, unknown>;
}

export interface LoadedContent {
  packs: Pack[];
  entries: Map<string, Entry>;
  exercises: Map<string, Exercise>;
  units: Map<string, Unit>;
  sheets: Map<string, Sheet>;
  issues: LoadIssue[];
}

const PACK_PATH = /\/([^/]+)\/pack\.json$/;
const UNIT_PATH = /\/([^/]+)\/units\/([^/]+)\.json$/;
const SHEET_PATH = /\/([^/]+)\/sheets\/([^/]+)\.json$/;

const globalId = (packId: string, ref: string) => (ref.includes('/') ? ref : `${packId}/${ref}`);
const pathOf = (path: PropertyKey[]) => path.map(String).join('.') || '(root)';
/** Template directories are prefixed with "_" so the app skips them; the pack id inside omits it. */
const packDir = (dir: string) => dir.replace(/^_/, '');

export function loadPacks(files: ContentFiles, exerciseTypes: Record<string, ExerciseTypeInfo>): LoadedContent {
  const issues: LoadIssue[] = [];
  const packs: Pack[] = [];
  const entries = new Map<string, Entry>();
  const exercises = new Map<string, Exercise>();
  const units = new Map<string, Unit>();
  const sheets = new Map<string, Sheet>();
  const practiceRefs: { file: string; path: string; key: string }[] = [];
  const refsToCheck: { file: string; path: string; id: string }[] = [];

  const unitFiles = new Map<string, { file: string; json: unknown }>();
  for (const [file, json] of Object.entries(files.units)) {
    const m = UNIT_PATH.exec(file);
    if (m) unitFiles.set(`${packDir(m[1]!)}/${m[2]}`, { file, json });
  }
  const sheetFiles = new Map<string, { file: string; json: unknown }>();
  for (const [file, json] of Object.entries(files.sheets ?? {})) {
    const m = SHEET_PATH.exec(file);
    if (m) sheetFiles.set(`${packDir(m[1]!)}/${m[2]}`, { file, json });
  }

  for (const [file, json] of Object.entries(files.packs)) {
    const dir = packDir(PACK_PATH.exec(file)?.[1] ?? '');
    const parsed = PackSchema.safeParse(json);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) issues.push({ file, path: pathOf(issue.path), message: issue.message });
      continue;
    }
    const manifest: PackManifest = parsed.data;
    if (manifest.id !== dir) {
      issues.push({ file, path: 'id', message: `id pakietu "${manifest.id}" musi być równe nazwie katalogu "${dir}"` });
    }

    const unitList: Unit[] = [];
    manifest.units.forEach((unitId, unitIndex) => {
      const found = unitFiles.get(`${dir}/${unitId}`);
      if (!found) {
        issues.push({ file, path: `units.${unitIndex}`, message: `brak pliku units/${unitId}.json` });
        return;
      }
      const unit = loadUnit(manifest, unitId, found.file, found.json);
      if (unit) unitList.push(unit);
    });

    const sheetList: Sheet[] = [];
    manifest.sheets.forEach((sheetId, sheetIndex) => {
      const found = sheetFiles.get(`${dir}/${sheetId}`);
      if (!found) {
        issues.push({ file, path: `sheets.${sheetIndex}`, message: `brak pliku sheets/${sheetId}.json` });
        return;
      }
      const sheet = loadSheet(manifest, sheetId, found.file, found.json);
      if (sheet) sheetList.push(sheet);
    });

    packs.push({ ...manifest, unitList, sheetList });
  }

  function loadSheet(pack: PackManifest, sheetId: string, file: string, json: unknown): Sheet | undefined {
    const parsed = SheetSchema.safeParse(json);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) issues.push({ file, path: pathOf(issue.path), message: issue.message });
      return undefined;
    }
    if (parsed.data.id !== sheetId) issues.push({ file, path: 'id', message: `id fiszki "${parsed.data.id}" musi być równe nazwie pliku "${sheetId}"` });
    parsed.data.practice.forEach((key, i) => practiceRefs.push({ file, path: `practice.${i}`, key }));
    const sheet: Sheet = { ...parsed.data, key: `${pack.id}/${parsed.data.id}`, packId: pack.id };
    sheets.set(sheet.key, sheet);
    return sheet;
  }

  function loadUnit(pack: PackManifest, unitId: string, file: string, json: unknown): Unit | undefined {
    const parsed = UnitSchema.safeParse(json);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) issues.push({ file, path: pathOf(issue.path), message: issue.message });
      return undefined;
    }
    const raw: RawUnit = parsed.data;
    if (raw.id !== unitId) issues.push({ file, path: 'id', message: `id jednostki "${raw.id}" musi być równe nazwie pliku "${unitId}"` });
    const key = `${pack.id}/${raw.id}`;

    raw.entries.forEach((e, i) => {
      const id = `${pack.id}/${e.id}`;
      if (entries.has(id)) issues.push({ file, path: `entries.${i}.id`, message: `zduplikowane id wpisu "${id}"` });
      const confusables = (e.confusables ?? []).map((c) => globalId(pack.id, c));
      confusables.forEach((c, j) => refsToCheck.push({ file, path: `entries.${i}.confusables.${j}`, id: c }));
      entries.set(id, { ...e, id, packId: pack.id, unitId: key, confusables });
    });

    raw.exercises.forEach((ex, i) => {
      const id = `${pack.id}/${ex.id}`;
      if (exercises.has(id)) issues.push({ file, path: `exercises.${i}.id`, message: `zduplikowane id ćwiczenia "${id}"` });
      const type = exerciseTypes[ex.type];
      if (!type) {
        issues.push({ file, path: `exercises.${i}.type`, message: `nieznany typ ćwiczenia "${ex.type}"` });
        return;
      }
      const data = type.schema.safeParse(ex.data);
      if (!data.success) {
        for (const issue of data.error.issues) {
          issues.push({ file, path: `exercises.${i}.data.${pathOf(issue.path)}`, message: issue.message });
        }
        return;
      }
      const entryIds = ex.entryIds.map((r) => globalId(pack.id, r));
      entryIds.forEach((r, j) => refsToCheck.push({ file, path: `exercises.${i}.entryIds.${j}`, id: r }));
      exercises.set(id, { ...ex, id, data: data.data, packId: pack.id, unitId: key, entryIds });
    });

    const boss = raw.boss && { ...raw.boss, entryIds: raw.boss.entryIds.map((r) => globalId(pack.id, r)) };
    boss?.entryIds.forEach((r, j) => refsToCheck.push({ file, path: `boss.entryIds.${j}`, id: r }));

    const unit: Unit = {
      id: raw.id,
      title: raw.title,
      icon: raw.icon,
      key,
      packId: pack.id,
      entryIds: raw.entries.map((e) => `${pack.id}/${e.id}`),
      exerciseIds: raw.exercises.map((ex) => `${pack.id}/${ex.id}`),
      boss,
    };
    units.set(key, unit);
    return unit;
  }

  for (const ref of refsToCheck) {
    if (!entries.has(ref.id)) issues.push({ file: ref.file, path: ref.path, message: `odwołanie do nieistniejącego wpisu "${ref.id}"` });
  }

  for (const ref of practiceRefs) {
    if (!units.has(ref.key)) issues.push({ file: ref.file, path: ref.path, message: `odwołanie do nieistniejącej jednostki "${ref.key}"` });
  }

  const packIds = new Set(packs.map((p) => p.id));
  for (const pack of packs) {
    pack.requires.forEach((r, i) => {
      if (!packIds.has(r)) issues.push({ file: `/content/${pack.id}/pack.json`, path: `requires.${i}`, message: `nieznany pakiet "${r}"` });
    });
  }

  const hasProduction = new Set<string>();
  for (const ex of exercises.values()) {
    if (exerciseTypes[ex.type]?.production) ex.entryIds.forEach((id) => hasProduction.add(id));
  }
  for (const entry of entries.values()) {
    if (!entry.deprecated && !hasProduction.has(entry.id)) {
      issues.push({
        file: `/content/${entry.packId}`,
        path: entry.id,
        message: 'wpis nie ma żadnego ręcznie napisanego ćwiczenia produkcyjnego (gap-fill / translate-pl-fr)',
      });
    }
  }

  return { packs, entries, exercises, units, sheets, issues };
}
