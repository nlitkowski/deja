import { z } from 'zod';
import { heardSentences } from '../heard';
import type { ExerciseLogic } from '../types';

export const MAX_DICTATION_WORDS = 8;

export const dictationWords = (text: string) => text.split(' ').length;

export const dicteeSchema = z.object({
  /** Played and typed in full. */
  text: z.string().min(1),
  /** The trained entry as it appears in the sentence: a mistake in these words fails the dictation. */
  key: z.string().min(1).optional(),
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
      .filter((h) => dictationWords(h.text) <= MAX_DICTATION_WORDS && !/\d/.test(h.text))
      .map((h) => ({ data: { text: h.text, key: h.gap?.answer ?? entry.fr }, entryIds: [entry.id] })),
};
