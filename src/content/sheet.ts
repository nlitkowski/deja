import { z } from 'zod';
import { LocalizedSchema } from './localized';

const localId = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'id: małe litery, cyfry i myślniki');
/** `<pack>/<unit>` of an exercise unit to practise this material with. */
const unitRef = z.string().regex(/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/, 'oczekiwano <pakiet>/<jednostka>');

const ExamplesBlock = z.object({
  type: z.literal('examples'),
  title: LocalizedSchema.optional(),
  /** `pl` is shown only with Polish help. */
  items: z.array(z.object({ fr: z.string().min(1), pl: z.string().min(1) })).min(1),
});

const WordsBlock = z.object({
  type: z.literal('words'),
  title: LocalizedSchema.optional(),
  /** `pl` is shown with Polish help, `def` (a short French gloss) with French help. */
  items: z.array(z.object({ fr: z.string().min(1), pl: z.string().min(1), def: z.string().min(1).optional() })).min(1),
});

const TableBlock = z
  .object({
    type: z.literal('table'),
    title: LocalizedSchema.optional(),
    head: z.array(z.string()).min(1),
    rows: z.array(z.array(z.string())).min(1),
  })
  .refine((t) => t.rows.every((r) => r.length === t.head.length), { message: 'każdy wiersz musi mieć tyle komórek co nagłówek', path: ['rows'] });

const TextBlock = z.object({
  /** `rule` is a highlighted key point, `warning` a common mistake. */
  type: z.enum(['text', 'rule', 'warning']),
  text: LocalizedSchema,
});

export const SheetBlockSchema = z.union([TextBlock, ExamplesBlock, WordsBlock, TableBlock]);

export const SheetSectionSchema = z.object({
  kind: z.enum(['grammar', 'vocabulary', 'phrases']),
  title: z.string().min(1),
  blocks: z.array(SheetBlockSchema).min(1),
});

export const SheetSchema = z.object({
  id: localId,
  /** Short label above the title, e.g. "Unité 4". */
  label: z.string().optional(),
  title: z.string().min(1),
  icon: z.string().min(1),
  summary: LocalizedSchema.optional(),
  sections: z.array(SheetSectionSchema).min(1),
  practice: z.array(unitRef).default([]),
});

export type SheetBlock = z.infer<typeof SheetBlockSchema>;
export type SheetSection = z.infer<typeof SheetSectionSchema>;
export type RawSheet = z.infer<typeof SheetSchema>;
export type Sheet = RawSheet & { key: string; packId: string };
