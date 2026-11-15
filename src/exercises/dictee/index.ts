import { z } from 'zod';
import { heardSentences } from '../heard';
import type { ExerciseLogic } from '../types';

export const MAX_DICTATION_WORDS = 8;

export const dicteeSchema = z.object({
  /** Played and typed in full. */
  text: z.string().min(1),
});

export type DicteeData = z.infer<typeof dicteeSchema>;

/** Full dictation of the entry's short sentences (gap-fills and examples). */
export const dictee: ExerciseLogic<DicteeData> = {
  id: 'dictee',
  schema: dicteeSchema,
  production: true,
  skill: 'listening',
  audioText: (d) => d.text,
  generate: (entry, ctx) =>
    heardSentences(entry, ctx)
      // Digits are read as words, and either spelling would be fair to type.
      .filter((h) => h.text.split(' ').length <= MAX_DICTATION_WORDS && !/\d/.test(h.text))
      .map((h) => ({ data: { text: h.text }, entryIds: [entry.id] })),
};
