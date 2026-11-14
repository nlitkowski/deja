import { z } from 'zod';
import type { ExerciseLogic } from '../types';

export const matchPairsSchema = z.object({
  pairs: z.array(z.object({ entryId: z.string(), fr: z.string().min(1), pl: z.string().min(1) })).min(2),
});

export type MatchPairsData = z.infer<typeof matchPairsSchema>;

export const PAIRS = 5;

/** The entry and the next four of its unit (wrapping round), French against Polish. */
export const matchPairs: ExerciseLogic<MatchPairsData> = {
  id: 'match-pairs',
  schema: matchPairsSchema,
  production: false,
  helpLangs: ['pl'],
  generate(entry, ctx) {
    const unit = ctx.unitEntries;
    const start = unit.findIndex((e) => e.id === entry.id);
    if (unit.length < PAIRS || start < 0) return [];
    const picked = Array.from({ length: PAIRS }, (_, i) => unit[(start + i) % unit.length]!);
    const distinct = (key: 'fr' | 'pl') => new Set(picked.map((e) => e[key])).size === PAIRS;
    if (!distinct('fr') || !distinct('pl')) return [];
    return [{ data: { pairs: picked.map((e) => ({ entryId: e.id, fr: e.fr, pl: e.pl })) }, entryIds: picked.map((e) => e.id) }];
  },
};
