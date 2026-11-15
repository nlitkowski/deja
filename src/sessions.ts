import { allEntries, content } from './content/registry';
import { isProduction, skillOf, supportsHelpLang } from './exercises/registry';
import { GAME } from './game/config';
import { dayKey } from './lib/date';
import { newIntroducedOn, type ProgressState } from './lib/progress/fold';
import { buildSession, type OtherSkill, type SessionItem } from './lib/session';
import type { Settings } from './lib/storage';

export const NEW_PER_DAY = 5;
const NEW_PER_UNIT_SESSION = 5;

function usableExercises(settings: Settings) {
  return [...content.exercises.values()].filter((ex) => supportsHelpLang(ex.type, settings.helpLang));
}

/** Listening and speaking cards for a review, unless quiet mode leaves out everything with sound. */
function otherSkills(progress: ProgressState, today: string, quiet: boolean): OtherSkill[] {
  if (quiet) return [];
  return (['listening', 'speaking'] as const).map((skill) => {
    const { requires, newPerDay, sessionShare } = GAME.skills[skill];
    return { skill, requires, share: sessionShare, newAllowed: Math.max(0, newPerDay - newIntroducedOn(progress, today, skill)) };
  });
}

export function buildReviewSession(progress: ProgressState, settings: Settings, { quiet = false, now = new Date() } = {}): SessionItem[] {
  const today = dayKey(now);
  return buildSession({
    entries: allEntries(),
    exercises: usableExercises(settings),
    srs: progress.cards,
    today,
    newAllowed: Math.max(0, NEW_PER_DAY - newIntroducedOn(progress, today)),
    isProduction,
    skillOf,
    otherSkills: otherSkills(progress, today, quiet),
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
    skillOf,
    mode: 'practice',
  });
}

/** Practice of the given entries only (the weakest ones from Stats), due or not. */
export function buildEntriesSession(progress: ProgressState, settings: Settings, entryIds: readonly string[], now = new Date()): SessionItem[] {
  const ids = new Set(entryIds);
  return buildSession({
    entries: entryIds.map((id) => content.entries.get(id)!).filter(Boolean),
    exercises: usableExercises(settings).filter((ex) => ex.entryIds.some((id) => ids.has(id))),
    srs: progress.cards,
    today: dayKey(now),
    newAllowed: 0,
    isProduction,
    skillOf,
    mode: 'practice',
    minPracticeItems: entryIds.length,
  });
}
