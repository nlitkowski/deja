import type { ExerciseTypeInfo } from '../content/loader';
import { confusableDuel } from './confusable-duel';
import { dictee } from './dictee';
import { dicteeTrous } from './dictee-trous';
import { ecouteSens } from './ecoute-sens';
import { gapFill } from './gap-fill';
import { matchPairs } from './match-pairs';
import { multipleChoice } from './multiple-choice';
import { pairesMinimales } from './paires-minimales';
import { translatePlFr } from './translate-pl-fr';
import type { ExerciseLogic } from './types';

/** Exercise types without their views, so content loads outside React (build scripts). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous list; data is validated by each type's schema
export const exerciseLogic: ExerciseLogic<any>[] = [
  gapFill,
  translatePlFr,
  multipleChoice,
  confusableDuel,
  matchPairs,
  dicteeTrous,
  dictee,
  ecouteSens,
  pairesMinimales,
];

export const exerciseTypeInfo: Record<string, ExerciseTypeInfo> = Object.fromEntries(
  exerciseLogic.map((t) => [t.id, { schema: t.schema, production: t.production, generate: t.generate }]),
);
