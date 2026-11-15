import { z } from 'zod';
import { hash, heardSentences } from '../heard';
import type { ExerciseLogic, Generated } from '../types';

export const ecouteSensSchema = z.object({
  audio: z.string().min(1),
  /** Polish translation of what is played. */
  answer: z.string().min(1),
  /** The answer first, then its distractors; the view shuffles them. */
  options: z.array(z.string().min(1)).min(3).max(4),
});

export type EcouteSensData = z.infer<typeof ecouteSensSchema>;

const DISTRACTORS = 3;

/** Hear a sentence, pick its Polish meaning. Distractors are translations of other entries of the unit. */
export const ecouteSens: ExerciseLogic<EcouteSensData> = {
  id: 'ecoute-sens',
  schema: ecouteSensSchema,
  production: false,
  skill: 'listening',
  helpLangs: ['pl'],
  audioText: (d) => d.audio,
  generate(entry, ctx) {
    const others = [
      ...new Set(
        ctx.unitEntries
          .filter((e) => e.id !== entry.id)
          .flatMap((e) => heardSentences(e, ctx).map((h) => h.pl))
          .filter((pl): pl is string => !!pl),
      ),
    ];
    const out: Generated<EcouteSensData>[] = [];
    for (const h of heardSentences(entry, ctx)) {
      if (!h.pl) continue;
      const distractors = others
        .filter((pl) => pl !== h.pl)
        .sort((a, b) => hash(h.text + a) - hash(h.text + b))
        .slice(0, DISTRACTORS);
      if (distractors.length < 2) continue;
      out.push({ data: { audio: h.text, answer: h.pl, options: [h.pl, ...distractors] }, entryIds: [entry.id] });
    }
    return out;
  },
};
