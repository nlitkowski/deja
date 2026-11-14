import { allEntries, content } from './content/registry';
import { isProduction, supportsHelpLang } from './exercises/registry';
import { dayKey } from './lib/date';
import { newIntroducedOn, type ProgressState } from './lib/progress/fold';
import { buildSession, type SessionItem } from './lib/session';
import type { Settings } from './lib/storage';

export const NEW_PER_DAY = 5;
const NEW_PER_UNIT_SESSION = 5;

function usableExercises(settings: Settings) {
  return [...content.exercises.values()].filter((ex) => supportsHelpLang(ex.type, settings.helpLang));
}

export function buildReviewSession(progress: ProgressState, settings: Settings, now = new Date()): SessionItem[] {
  const today = dayKey(now);
  return buildSession({
    entries: allEntries(),
    exercises: usableExercises(settings),
    srs: progress.cards,
    today,
    newAllowed: Math.max(0, NEW_PER_DAY - newIntroducedOn(progress, today)),
    isProduction,
    mode: 'review',
  });
}

export function buildUnitSession(progress: ProgressState, settings: Settings, unitKey: string, now = new Date()): SessionItem[] {
  const unit = content.units.get(unitKey);
  if (!unit) return [];
  return buildSession({
    entries: unit.entryIds.map((id) => content.entries.get(id)!),
    exercises: usableExercises(settings).filter((ex) => ex.unitId === unitKey),
    srs: progress.cards,
    today: dayKey(now),
    newAllowed: NEW_PER_UNIT_SESSION,
    isProduction,
    mode: 'practice',
  });
}
