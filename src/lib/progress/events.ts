import type { DayKey } from '../date';
import type { Grade, Skill, SrsCard } from '../srs';

/**
 * Progress is an append-only log of events; everything else (SRS cards, new-per-day, later XP and streaks)
 * is derived from it. Events are immutable and globally unique, so logs from several devices can be merged
 * by union and folded in order — the basis for a future sync backend.
 */
interface EventBase {
  id: string;
  deviceId: string;
  /** ISO timestamp: orders events across devices. */
  at: string;
  /** Learning day (local time, 4:00 reset) the event belongs to. */
  day: DayKey;
}

export interface ReviewEvent extends EventBase {
  type: 'review';
  exerciseId: string;
  entryIds: string[];
  grade: Grade;
  correct: boolean;
  nearMiss: boolean;
  hintUsed: boolean;
  timeMs: number;
  /** Practised before it was due: a correct answer leaves the schedule unchanged. */
  early: boolean;
  sessionId?: string;
  /** Correct answers in a row just before this one. Depends on the order within a session, so it is stored, not derived. */
  comboBefore?: number;
  /** Typed or chosen, when the exercise id alone does not tell (a boss asks both kinds about one exercise). */
  production?: boolean;
  /** Card the answer trains; omitted = written (every event from before listening and speaking). */
  skill?: Skill;
}

export const reviewSkill = (event: ReviewEvent): Skill => event.skill ?? 'written';

export type SessionKind = 'review' | 'unit' | 'boss';

/** Written when a session is completed (not when it is left early). */
export interface SessionEvent extends EventBase {
  type: 'session';
  sessionId: string;
  kind: SessionKind;
  unitKey?: string;
  startedAt: string;
  items: number;
  correct: number;
  mistakes: number;
  maxCombo: number;
  /** Boss sessions only: won with lives left. */
  defeated?: boolean;
}

/** A setting whose history matters for derived state (the daily goal decides past streak days). */
export interface SettingEvent extends EventBase {
  type: 'setting';
  key: 'dailyGoal';
  value: number;
}

/** SRS state imported from the pre-event-log storage; history starts after it. */
export interface BaselineEvent extends EventBase {
  type: 'baseline';
  cards: Record<string, SrsCard>;
  /** New entries already introduced on the baseline's day, so the daily limit carries over. */
  introduced?: { day: DayKey; count: number };
}

/** A completed quest's reward, claimed by the learner: the XP lives in the log like every other XP. */
export interface QuestEvent extends EventBase {
  type: 'quest';
  questId: string;
  /** First day of the quest's period (the day, or the Monday of a weekly quest). */
  period: DayKey;
  xp: number;
}

export type ProgressEvent = ReviewEvent | BaselineEvent | SessionEvent | SettingEvent | QuestEvent;

export function newEventId(): string {
  return crypto.randomUUID();
}
