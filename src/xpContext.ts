import { content } from './content/registry';
import { isProduction } from './exercises/registry';
import type { XpContext } from './game/xp';

export const xpContext: XpContext = {
  isProduction: (exerciseId) => isProduction(content.exercises.get(exerciseId)?.type ?? ''),
  exerciseType: (exerciseId) => content.exercises.get(exerciseId)?.type,
};
