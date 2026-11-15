import { z } from 'zod';
import { GAP } from '../gap-fill';
import { heardSentences } from '../heard';
import type { ExerciseLogic } from '../types';

export const dicteeTrousSchema = z.object({
  sentence: z.string().refine((s) => s.split(GAP).length === 2),
  /** Only the word that was said: other answers of the gap-fill sound different. */
  answer: z.string().min(1),
  audio: z.string().min(1),
});

export type DicteeTrousData = z.infer<typeof dicteeTrousSchema>;

/** The whole sentence is played; the learner types the word in the gap. One per hand-written gap-fill. */
export const dicteeTrous: ExerciseLogic<DicteeTrousData> = {
  id: 'dictee-trous',
  schema: dicteeTrousSchema,
  production: true,
  skill: 'listening',
  audioText: (d) => d.audio,
  generate: (entry, ctx) =>
    heardSentences(entry, ctx).flatMap((h) =>
      h.gap && !/\d/.test(h.gap.answer) ? [{ data: { sentence: h.gap.sentence, answer: h.gap.answer, audio: h.text }, entryIds: [entry.id] }] : [],
    ),
};
