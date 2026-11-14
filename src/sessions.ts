import { allEntries, content } from './content/registry';
import { isProduction, supportsHelpLang } from './exercises/registry';
import { dayKey } from './lib/date';
import { buildSession, type SessionItem } from './lib/session';
import type { SavedState } from './lib/storage';

export const NEW_PER_DAY = 5;
const NEW_PER_UNIT_SESSION = 5;

function usableExercises(state: SavedState) {
  return [...content.exercises.values()].filter((ex) => supportsHelpLang(ex.type, state.settings.helpLang));
}

export function buildReviewSession(state: SavedState): SessionItem[] {
  return buildSession({
    entries: allEntries(),
    exercises: usableExercises(state),
    srs: state.srs,
    today: dayKey(new Date()),
    newAllowed: Math.max(0, NEW_PER_DAY - state.daily.newIntroduced),
    isProduction,
    mode: 'review',
  });
}

export function buildUnitSession(state: SavedState, unitKey: string): SessionItem[] {
  const unit = content.units.get(unitKey);
  if (!unit) return [];
  return buildSession({
    entries: unit.entryIds.map((id) => content.entries.get(id)!),
    exercises: usableExercises(state).filter((ex) => ex.unitId === unitKey),
    srs: state.srs,
    today: dayKey(new Date()),
    newAllowed: NEW_PER_UNIT_SESSION,
    isProduction,
    mode: 'practice',
  });
}
