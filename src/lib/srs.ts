import { addDays, type DayKey } from './date';

export type Grade = 'again' | 'hard' | 'good' | 'easy';

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
}

export const SRS = {
  startEase: 2.5,
  minEase: 1.3,
  fastAnswerMs: 5000,
} as const;

export function gradeFromResult(r: AnswerResult): Grade {
  if (r.grade) return r.grade;
  if (!r.correct) return 'again';
  if (r.nearMiss || r.hintUsed) return 'hard';
  return r.timeMs < SRS.fastAnswerMs ? 'easy' : 'good';
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
