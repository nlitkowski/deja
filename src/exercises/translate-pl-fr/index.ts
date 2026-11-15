import { z } from 'zod';
import { LocalizedSchema } from '../../content/localized';
import type { ExerciseLogic } from '../types';

export const translateSchema = z.object({
  pl: z.string().min(1),
  answers: z.array(z.string().min(1)).min(1),
  hint: LocalizedSchema.optional(),
});

export type TranslateData = z.infer<typeof translateSchema>;

export const translatePlFr: ExerciseLogic<TranslateData> = {
  id: 'translate-pl-fr',
  schema: translateSchema,
  production: true,
  skill: 'written',
  helpLangs: ['pl'],
};
