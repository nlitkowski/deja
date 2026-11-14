import { z } from 'zod';
import { LocalizedSchema } from './localized';
import type { Sheet } from './sheet';

const localId = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'id: małe litery, cyfry i myślniki');
/** Local id (`prep-dans`) or cross-pack reference (`other-pack/prep-dans`). */
const entryRef = z.string().regex(/^([a-z0-9][a-z0-9-]*\/)?[a-z0-9][a-z0-9-]*$/, 'oczekiwano <entry> albo <pack>/<entry>');

export const ExampleSchema = z.object({ fr: z.string().min(1), pl: z.string().min(1) });

export const EntrySchema = z.object({
  id: localId,
  fr: z.string().min(1),
  /** Meaning in Polish. */
  pl: z.string().min(1),
  /** Meaning explained in simple French; falls back to `pl`. */
  def: z.string().min(1).optional(),
  examples: z.array(ExampleSchema).min(1),
  tip: LocalizedSchema.optional(),
  confusables: z.array(entryRef).optional(),
  tags: z.array(z.string()).optional(),
  deprecated: z.boolean().optional(),
});

export const ExerciseSchema = z.object({
  id: localId,
  type: z.string().min(1),
  entryIds: z.array(entryRef).min(1),
  data: z.unknown(),
});

export const BossConfigSchema = z.object({
  /** Entries the boss mixes up; a group of one entry only gets typed questions. */
  groups: z.array(z.array(entryRef).min(1)).min(1),
  questions: z.number().int().positive().default(10),
  lives: z.number().int().positive().default(3),
  secondsPerQuestion: z.number().positive().default(12),
});

export const UnitSchema = z.object({
  id: localId,
  title: z.string().min(1),
  icon: z.string().min(1),
  entries: z.array(EntrySchema).min(1),
  exercises: z.array(ExerciseSchema),
  boss: BossConfigSchema.optional(),
});

export const PackAchievementSchema = z.object({
  id: localId,
  title: z.string().min(1),
  icon: z.string().min(1),
  description: z.string().optional(),
  condition: z.looseObject({ type: z.string() }),
});

export const PackSchema = z
  .object({
    id: localId,
    version: z.number().int().nonnegative(),
    title: z.string().min(1),
    level: z.string().min(1),
    icon: z.string().min(1),
    requires: z.array(localId).default([]),
    /** Exercise units: `units/<id>.json`. */
    units: z.array(localId).default([]),
    /** Review sheets to read: `sheets/<id>.json`. */
    sheets: z.array(localId).default([]),
    /** Word pairs where a missing accent yields a different valid word (ou/où), so it is wrong, not a near miss. */
    accentPairs: z.array(z.tuple([z.string(), z.string()])).default([]),
    achievements: z.array(PackAchievementSchema).default([]),
  })
  .refine((p) => p.units.length + p.sheets.length > 0, { message: 'pakiet potrzebuje co najmniej jednej jednostki albo fiszki', path: ['units'] });

export type Example = z.infer<typeof ExampleSchema>;
export type RawEntry = z.infer<typeof EntrySchema>;
export type RawExercise = z.infer<typeof ExerciseSchema>;
export type BossConfig = z.infer<typeof BossConfigSchema>;
export type RawUnit = z.infer<typeof UnitSchema>;
export type PackManifest = z.infer<typeof PackSchema>;

/** Entry after loading: ids are global (`<pack>/<entry>`). */
export type Entry = Omit<RawEntry, 'id' | 'confusables'> & {
  id: string;
  packId: string;
  unitId: string;
  confusables: string[];
};

export type Exercise = Omit<RawExercise, 'id' | 'entryIds'> & {
  id: string;
  packId: string;
  unitId: string;
  entryIds: string[];
  /** Built by an exercise type's `generate` from hand-written content, not read from a file. */
  generated?: boolean;
};

export type Unit = Omit<RawUnit, 'entries' | 'exercises' | 'boss'> & {
  key: string;
  packId: string;
  entryIds: string[];
  exerciseIds: string[];
  boss?: BossConfig;
};

export type Pack = PackManifest & { unitList: Unit[]; sheetList: Sheet[] };
