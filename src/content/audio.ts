import { z } from 'zod';

/** How a French text is recorded. Lives next to the text it is about (entry, example, exercise, word, table). */
export const AudioSchema = z.strictObject({
  /** Not recorded, e.g. a proper name speech synthesis mangles. */
  skip: z.boolean().optional(),
  /** What to read when it differs from the written form (numbers, abbreviations, letter names). */
  text: z.string().min(1).optional(),
  /** False keeps it out of dictation: it sounds like another valid sentence (il parle / ils parlent). */
  dictation: z.boolean().optional(),
});

export type Audio = z.infer<typeof AudioSchema>;
