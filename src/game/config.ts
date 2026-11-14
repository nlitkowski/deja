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
  /** The combo counter shows from this many correct answers in a row. */
  comboVisibleFrom: 3,
} as const;
