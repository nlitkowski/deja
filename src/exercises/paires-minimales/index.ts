import { z } from 'zod';
import type { ExerciseLogic } from '../types';
import { soundsAlike } from './sound';

export const pairesMinimalesSchema = z.object({
  /** Two texts that differ by one sound; one of them is played and the learner picks how it is written. */
  pair: z
    .tuple([z.string().min(1), z.string().min(1)])
    .refine(([a, b]) => !soundsAlike(a, b), 'homofony: obie strony brzmią tak samo, więc ze słuchu nie da się ich rozróżnić'),
});

export type PairesMinimalesData = z.infer<typeof pairesMinimalesSchema>;

/** Hand-written in units; the side to play is drawn each time, so both need a recording. */
export const pairesMinimales: ExerciseLogic<PairesMinimalesData> = {
  id: 'paires-minimales',
  schema: pairesMinimalesSchema,
  production: false,
  skill: 'listening',
  listenTexts: (d) => [...d.pair],
};
