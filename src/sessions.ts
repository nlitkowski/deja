import { knownSentence, sentenceEntries } from './audio/sentenceEntries';
import { allEntries, content } from './content/registry';
import { dictationWords, type DicteeData } from './exercises/dictee';
import { isProduction, skillOf, supportsHelpLang } from './exercises/registry';
import { GAME } from './game/config';
import { ladderPicker, ladderRetry, rungOf } from './game/listeningLadder';
import { skillMastery } from './game/mastery';
import { dayKey } from './lib/date';
import { newIntroducedOn, type ProgressState } from './lib/progress/fold';
import { buildSession, type OtherSkill, type RetryPicker, type SessionExercise, type SessionItem } from './lib/session';
import { cardKey, type SrsCard } from './lib/srs';
import type { Settings } from './lib/storage';

export const NEW_PER_DAY = GAME.newPerDay;
const NEW_PER_UNIT_SESSION = 5;

function usableExercises(settings: Settings) {
  return [...content.exercises.values()].filter((ex) => supportsHelpLang(ex.type, settings.helpLang));
}

let sentences: Map<string, Set<string>> | undefined;

/** A listening exercise's rung; a full dictation only from sentences whose other entries were all seen in writing. */
function listeningRung(cards: Readonly<Record<string, SrsCard>>) {
  return (ex: SessionExercise) => {
    if (ex.type !== 'dictee') return rungOf(ex.type);
    const { text } = content.exercises.get(ex.id)!.data as DicteeData;
    sentences ??= sentenceEntries(content.exercises.values(), content.entries.values());
    return knownSentence(text, ex.entryIds, sentences, (id) => !!cards[cardKey(id, 'written')]) ? rungOf('dictee', dictationWords(text)) : -1;
  };
}

export const listeningRetry = (cards: Readonly<Record<string, SrsCard>>): RetryPicker => ladderRetry(listeningRung(cards));

/** Listening and speaking cards for a review, unless quiet mode leaves out everything with sound. */
function otherSkills(progress: ProgressState, today: string, quiet: boolean): OtherSkill[] {
  if (quiet) return [];
  const listening = ladderPicker((id) => skillMastery(progress.cards, id, 'listening'), listeningRung(progress.cards));
  return (['listening', 'speaking'] as const).map((skill) => {
    const { requires, newPerDay, sessionShare } = GAME.skills[skill];
    return {
      skill,
      requires,
      share: sessionShare,
      newAllowed: Math.max(0, newPerDay - newIntroducedOn(progress, today, skill)),
      ...(skill === 'listening' ? { pick: listening } : {}),
    };
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
