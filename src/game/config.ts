/** Every tunable number of the game in one place. */
export const GAME = {
  xp: {
    production: 10,
    recognition: 4,
    noHint: 1.2,
    nearMiss: 0.5,
    /** Multiplier from this many correct answers in a row (this answer included). */
    combo: [
      { from: 10, multiplier: 2 },
      { from: 5, multiplier: 1.5 },
    ],
    sessionComplete: 10,
    perfectSession: 20,
    perfectSessionMinItems: 10,
    bossDefeated: 100,
    /** Answers about entries that are already at mastery 5 (all of them) are worth less: no farming. */
    masteredMultiplier: 0.5,
  },
  mastery: {
    /** Minimum interval in days for mastery 2, 3, 4 and 5. */
    intervals: [3, 7, 21, 60],
    goldReps: 4,
    /** A unit's next unit opens at this unit mastery; its boss at `bossFrom`. */
    unlockNext: 1,
    bossFrom: 2,
  },
  level: {
    base: 50,
    exponent: 1.5,
    titles: ['Débutant', 'Touriste', 'Flâneur', 'Bavard', 'Habitué', 'Parisien', 'Érudit', 'Académicien'],
  },
  streak: {
    /** Goal for days before the first recorded change; matches the default setting. */
    defaultGoal: 50,
    goals: [30, 50, 100],
    freezeEvery: 7,
    maxFreezes: 2,
  },
  quests: { daily: 3, weekly: 1, dailyReward: 20, weeklyReward: 100 },
  /** A boss without its own config in the unit file. */
  boss: { questions: 10, lives: 3, secondsPerQuestion: 12 },
  /** The combo counter shows from this many correct answers in a row. */
  comboVisibleFrom: 3,
} as const;
