import { z } from 'zod';
import { GAP } from '../gap-fill';
import { gapSentences, inSentence, labelOf, sameWord, type GapSentence } from '../gapSentences';
import type { ExerciseLogic } from '../types';

const duelSentenceSchema = z.object({
  entryId: z.string(),
  sentence: z.string().refine((s) => s.split(GAP).length === 2),
  answer: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  pl: z.string().optional(),
  clue: z.string().optional(),
});

export const duelSchema = z.object({
  sentences: z.array(duelSentenceSchema).min(1),
  secondsPerSentence: z.number().positive(),
});

export type DuelData = z.infer<typeof duelSchema>;
export type DuelSentence = z.infer<typeof duelSentenceSchema>;

export const DUEL = { sentences: 5, minSentences: 3, maxEntries: 3, secondsPerSentence: 8 } as const;

/** Round-robin over the group so every entry gets its turn. */
function interleave(lists: GapSentence[][], count: number): GapSentence[] {
  const out: GapSentence[] = [];
  for (let i = 0; out.length < count && lists.some((l) => i < l.length); i++) {
    for (const list of lists) if (i < list.length && out.length < count) out.push(list[i]!);
  }
  return out;
}

/**
 * The entry against its confusables (2–3 entries): a quick series of their gap-fill sentences,
 * each answered by picking one of the entries. Every sentence counts for its own entry.
 */
export const confusableDuel: ExerciseLogic<DuelData> = {
  id: 'confusable-duel',
  schema: duelSchema,
  production: false,
  skill: 'written',
  generate(entry, ctx) {
    const group = [entry.id, ...entry.confusables]
      .filter((id) => !ctx.allEntries.get(id)?.deprecated && labelOf(id, ctx))
      .slice(0, DUEL.maxEntries);
    if (group.length < 2) return [];

    const labels = new Map(group.map((id) => [id, labelOf(id, ctx)!]));
    const sentences: DuelSentence[] = interleave(
      group.map((id) => gapSentences(id, ctx)),
      DUEL.sentences,
    ).map((s) => {
      const answer = s.answers[0]!;
      const others = group.filter((id) => id !== s.entryId).map((id) => inSentence(labels.get(id)!, s.sentence));
      const options = [answer, ...others.filter((o) => !s.answers.some((a) => sameWord(a, o)))];
      return { entryId: s.entryId, sentence: s.sentence, answer, options: [...new Set(options)], pl: s.pl, clue: s.clue };
    });
    const usable = sentences.filter((s) => s.options.length >= 2);
    if (usable.length < DUEL.minSentences) return [];
    return [
      {
        data: { sentences: usable, secondsPerSentence: DUEL.secondsPerSentence },
        entryIds: [...new Set(usable.map((s) => s.entryId))],
      },
    ];
  },
};
