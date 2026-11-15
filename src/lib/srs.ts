import { addDays, type DayKey } from './date';

export type Grade = 'again' | 'hard' | 'good' | 'easy';

/** What a card trains: an entry has up to one card per skill, each scheduled on its own. */
export type Skill = 'written' | 'listening' | 'speaking';

/**
 * Key of an entry's card for a skill. The written card keeps the bare entry id, so every card stored so far
 * (in events and baselines) stays valid; other skills get `entryId#skill`.
 */
export const cardKey = (entryId: string, skill: Skill = 'written'): string => (skill === 'written' ? entryId : `${entryId}#${skill}`);

export function skillOfKey(key: string): Skill {
  const hash = key.lastIndexOf('#');
  return hash < 0 ? 'written' : (key.slice(hash + 1) as Skill);
}

export interface SrsCard {
  ease: number;
  interval: number;
  due: DayKey;
  /** Consecutive correct reviews. */
  reps: number;
  lapses: number;
  correctTotal: number;
  lastReviewed: DayKey;
}

export interface AnswerResult {
  correct: boolean;
  nearMiss: boolean;
  timeMs: number;
  hintUsed: boolean;
  /** Self-assessment (flashcards); overrides the automatic grade. */
  grade?: Grade;
  given?: string;
  expected?: string;
  /**
   * Exercises that ask about several entries (duel, pairs) report each answer separately;
   * every part becomes its own review event, for its own entries.
   */
  parts?: AnswerPart[];
}

export interface AnswerPart {
  entryIds: string[];
  correct: boolean;
  timeMs: number;
}

export const SRS = {
  startEase: 2.5,
  minEase: 1.3,
  // An answer is "easy" when typed faster than this; longer answers get more time.
  fastAnswerBaseMs: 4000,
  fastAnswerPerCharMs: 250,
  fastAnswerMaxMs: 15000,
} as const;

export function fastAnswerMs(expected = ''): number {
  return Math.min(SRS.fastAnswerMaxMs, SRS.fastAnswerBaseMs + SRS.fastAnswerPerCharMs * expected.length);
}

export function gradeFromResult(r: AnswerResult): Grade {
  if (r.grade) return r.grade;
  if (!r.correct) return 'again';
  if (r.nearMiss || r.hintUsed) return 'hard';
  return r.timeMs < fastAnswerMs(r.expected) ? 'easy' : 'good';
}

export function review(card: SrsCard | undefined, grade: Grade, today: DayKey): SrsCard {
  const prev: SrsCard = card ?? {
    ease: SRS.startEase,
    interval: 0,
    due: today,
    reps: 0,
    lapses: 0,
    correctTotal: 0,
    lastReviewed: today,
  };
  const { lapses } = prev;
  let { ease, interval, reps, correctTotal } = prev;

  switch (grade) {
    case 'again':
      ease = Math.max(SRS.minEase, ease - 0.2);
      return { ...prev, ease, interval: 0, due: today, reps: 0, lapses: lapses + 1, lastReviewed: today };
    case 'hard':
      ease = Math.max(SRS.minEase, ease - 0.15);
      interval = reps === 0 ? 1 : Math.max(interval + 1, Math.round(interval * 1.2));
      break;
    case 'good':
      interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(interval + 1, Math.round(interval * ease));
      break;
    case 'easy':
      ease += 0.15;
      interval = reps === 0 ? 2 : reps === 1 ? 4 : Math.max(interval + 1, Math.round(interval * ease * 1.3));
      break;
  }
  reps += 1;
  correctTotal += 1;
  return { ease, interval, due: addDays(today, interval), reps, lapses, correctTotal, lastReviewed: today };
}

export const isDue = (card: SrsCard, today: DayKey) => card.due <= today;
