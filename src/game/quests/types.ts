import type { DayKey } from '../../lib/date';
import type { ReviewEvent, SessionEvent } from '../../lib/progress/events';
import type { SrsCard } from '../../lib/srs';

/** What happened in a quest's period (a day or a week), derived from the log. */
export interface QuestDigest {
  /** In log order, with the cards of the answer's entries as they were just before it. */
  reviews: { event: ReviewEvent; before: SrsCard[] }[];
  sessions: SessionEvent[];
  xp: number;
  /** Days of the period so far, with the XP earned and the goal in force. */
  days: { day: DayKey; xp: number; goal: number }[];
  isProduction: (exerciseId: string) => boolean;
  /** Entries with confusables: the traps. */
  isTricky: (entryId: string) => boolean;
}

export interface Quest {
  id: string;
  period: 'day' | 'week';
  /** In French, like the rest of the interface. */
  title: string;
  icon: string;
  target: (d: QuestDigest) => number;
  progress: (d: QuestDigest) => number;
}

export type QuestModule = { default: Quest };
