import { z } from 'zod';
import { LocalizedSchema } from '../../content/localized';
import type { ExerciseLogic } from '../types';

export const GAP = '___';

export const gapFillSchema = z.object({
  sentence: z.string().refine((s) => s.split(GAP).length === 2, `zdanie musi zawierać dokładnie jedną lukę ${GAP}`),
  answers: z.array(z.string().min(1)).min(1),
  hint: LocalizedSchema.optional(),
  /** Polish translation, shown in Polish help mode. */
  pl: z.string().optional(),
  /** French context clue that makes the gap unambiguous, shown in French help mode. */
  clue: z.string().optional(),
});

export type GapFillData = z.infer<typeof gapFillSchema>;

export const gapFill: ExerciseLogic<GapFillData> = {
  id: 'gap-fill',
  schema: gapFillSchema,
  production: true,
  skill: 'written',
};
