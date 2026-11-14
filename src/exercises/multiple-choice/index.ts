import { z } from 'zod';
import { GAP } from '../gap-fill';
import { gapSentences, inSentence, labelOf, sameWord } from '../gapSentences';
import type { ExerciseLogic, Generated } from '../types';

export const multipleChoiceSchema = z.object({
  sentence: z.string().refine((s) => s.split(GAP).length === 2),
  answer: z.string().min(1),
  /** The answer first, then its distractors; the view shuffles them. */
  options: z.array(z.string().min(1)).min(3).max(4),
  pl: z.string().optional(),
  clue: z.string().optional(),
});

export type MultipleChoiceData = z.infer<typeof multipleChoiceSchema>;

export const MIN_DISTRACTORS = 2;
const MAX_DISTRACTORS = 3;

/**
 * One question per hand-written gap-fill of the entry. Distractors: confusable entries first (any pack),
 * then the rest of the unit; never a word the sentence also accepts.
 */
export const multipleChoice: ExerciseLogic<MultipleChoiceData> = {
  id: 'multiple-choice',
  schema: multipleChoiceSchema,
  production: false,
  generate(entry, ctx) {
    const candidates = [...entry.confusables, ...ctx.unitEntries.map((e) => e.id)].filter(
      (id) => id !== entry.id && !ctx.allEntries.get(id)?.deprecated,
    );
    const labels = candidates.map((id) => labelOf(id, ctx)).filter((l): l is string => !!l);

    const out: Generated<MultipleChoiceData>[] = [];
    for (const s of gapSentences(entry.id, ctx)) {
      const distractors: string[] = [];
      for (const label of labels) {
        if (distractors.length === MAX_DISTRACTORS) break;
        if (s.answers.some((a) => sameWord(a, label)) || distractors.some((d) => sameWord(d, label))) continue;
        distractors.push(label);
      }
      if (distractors.length < MIN_DISTRACTORS) continue;
      const answer = s.answers[0]!;
      out.push({
        data: { sentence: s.sentence, answer, options: [answer, ...distractors.map((d) => inSentence(d, s.sentence))], pl: s.pl, clue: s.clue },
        entryIds: [entry.id],
      });
    }
    return out;
  },
};
