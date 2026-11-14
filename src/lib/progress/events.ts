import type { DayKey } from '../date';
import type { Grade, SrsCard } from '../srs';

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
}

/** SRS state imported from the pre-event-log storage; history starts after it. */
export interface BaselineEvent extends EventBase {
  type: 'baseline';
  cards: Record<string, SrsCard>;
  /** New entries already introduced on the baseline's day, so the daily limit carries over. */
  introduced?: { day: DayKey; count: number };
}

export type ProgressEvent = ReviewEvent | BaselineEvent;

export function newEventId(): string {
  return crypto.randomUUID();
}
