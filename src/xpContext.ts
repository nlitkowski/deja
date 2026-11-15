import { content } from './content/registry';
import { isProduction } from './exercises/registry';
import type { XpContext } from './game/xp';

/** Removed exercises keep their type (hand-written ones listed in the unit, generated ones named `<entry>~<type>-<n>`), so past XP stays. */
const typeOf = (exerciseId: string): string | undefined =>
  content.exercises.get(exerciseId)?.type ?? content.retiredExercises.get(exerciseId) ?? /~([a-z-]+)-\d+$/.exec(exerciseId)?.[1];

export const xpContext: XpContext = {
  isProduction: (exerciseId) => isProduction(typeOf(exerciseId) ?? ''),
  exerciseType: typeOf,
};
