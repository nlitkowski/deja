/** Everything a badge can look at: a projection of the event log. */
export interface AchievementStats {
  sessions: number;
  correct: number;
  bestStreak: number;
  maxCombo: number;
  perfectSessions: number;
  /** Longest run of correct answers without a missing accent. */
  accentRun: number;
  /** Times an entry was answered correctly right after 3 mistakes in a row on it. */
  rescues: number;
  nightSessions: number;
  earlySessions: number;
  defeatedBosses: ReadonlySet<string>;
  goldenUnits: number;
}

export interface Achievement {
  id: string;
  /** Badge name, in French like the rest of the interface. */
  title: string;
  /** What earns it, in the help language: also the hint on a locked badge. */
  description: { pl: string; fr: string };
  icon: string;
  check: (stats: AchievementStats) => boolean;
  /** Progress towards it, for the gallery: [current, target]. */
  progress?: (stats: AchievementStats) => [number, number];
}

/** A badge file exports one badge or a tier of them. */
export type AchievementModule = { default: Achievement | Achievement[] };

export const tiers = (
  values: readonly number[],
  make: (n: number) => Omit<Achievement, 'check' | 'progress'>,
  measure: (s: AchievementStats) => number,
): Achievement[] =>
  values.map((n) => ({ ...make(n), check: (s) => measure(s) >= n, progress: (s) => [Math.min(measure(s), n), n] }));
