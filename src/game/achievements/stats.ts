import type { DayKey } from '../../lib/date';
import { reviewSkill, type ProgressEvent } from '../../lib/progress/events';
import { compareEvents } from '../../lib/progress/fold';
import { cardKey, type SrsCard } from '../../lib/srs';
import { GAME } from '../config';
import { defeatedBosses, type MapUnit } from '../map';
import { entryMastery, unitMastery } from '../mastery';
import type { Peaks } from '../peaks';
import { streakInfo } from '../streak';
import type { XpContext } from '../xp';
import type { AchievementStats } from './types';

export interface StatsInput {
  cards: Readonly<Record<string, SrsCard>>;
  units: readonly MapUnit[];
  today: DayKey;
  xp: XpContext;
  /** Highest crown of each unit: Maîtrisé, once earned, stays. */
  peaks?: Peaks;
}

/** Local hour of an event, on this device's clock: night and morning badges follow the learner's day. */
const localHour = (at: string) => new Date(at).getHours();

export function achievementStats(events: readonly ProgressEvent[], { cards, units, today, xp, peaks = new Map() }: StatsInput): AchievementStats {
  const sorted = [...events].sort(compareEvents);
  const stats: AchievementStats = {
    sessions: 0,
    correct: 0,
    bestStreak: streakInfo(events, today, xp).best,
    maxCombo: 0,
    perfectSessions: 0,
    accentRun: 0,
    rescues: 0,
    nightSessions: 0,
    earlySessions: 0,
    defeatedBosses: defeatedBosses(events),
    goldenUnits: units.filter((u) => Math.max(peaks.get(u.key) ?? 0, unitMastery(u.entryIds, cards)) === 5).length,
    listeningCorrect: 0,
    cleanDictations: 0,
    cleanListeningSessions: 0,
    goldenListeningUnits: units.filter((u) => u.entryIds.length && u.entryIds.every((id) => entryMastery(cards[cardKey(id, 'listening')]) === 5)).length,
  };
  const completed = new Set(sorted.flatMap((e) => (e.type === 'session' ? [e.sessionId] : [])));
  const listeningBySession = new Map<string, { answers: number; replayed: boolean }>();

  let accentRun = 0;
  const wrongInARow = new Map<string, number>();
  for (const e of sorted) {
    if (e.type === 'session') {
      stats.sessions += 1;
      if (e.mistakes === 0 && e.items >= GAME.xp.perfectSessionMinItems) stats.perfectSessions += 1;
      const hour = localHour(e.at);
      if (hour >= 23 || hour < 4) stats.nightSessions += 1;
      else if (hour < 7) stats.earlySessions += 1;
    }
    if (e.type !== 'review') continue;

    if (e.correct) {
      stats.correct += 1;
      stats.maxCombo = Math.max(stats.maxCombo, (e.comboBefore ?? 0) + 1);
    }
    if (reviewSkill(e) === 'listening') {
      if (e.correct) stats.listeningCorrect += 1;
      if (e.correct && !e.nearMiss && xp.exerciseType?.(e.exerciseId) === 'dictee') stats.cleanDictations += 1;
      if (e.sessionId) {
        const s = listeningBySession.get(e.sessionId) ?? { answers: 0, replayed: false };
        listeningBySession.set(e.sessionId, { answers: s.answers + 1, replayed: s.replayed || !!e.replays });
      }
    }
    accentRun = e.correct && !e.nearMiss ? accentRun + 1 : 0;
    stats.accentRun = Math.max(stats.accentRun, accentRun);

    for (const id of e.entryIds) {
      const misses = wrongInARow.get(id) ?? 0;
      if (!e.correct) wrongInARow.set(id, misses + 1);
      else {
        if (misses >= 3) stats.rescues += 1;
        wrongInARow.set(id, 0);
      }
    }
  }
  for (const [id, s] of listeningBySession) {
    if (completed.has(id) && !s.replayed && s.answers >= GAME.cleanListeningMin) stats.cleanListeningSessions += 1;
  }
  return stats;
}
