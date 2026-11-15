/** Every tunable number of the game in one place. */
export const GAME = {
  xp: {
    production: 10,
    recognition: 4,
    /** Exercise types worth more than their kind's base (a full dictation is the hardest typing). */
    byType: { dictee: 12 } as Readonly<Record<string, number>>,
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
    intervals: [3, 7, 20, 60],
    goldReps: 4,
    /** Unit crown L: at least `unitShare` of its entries at mastery ≥ L, and none below L − `unitMaxGap`. */
    unitShare: 0.8,
    unitMaxGap: 2,
    /** The next unit opens once every entry is seen (mastery ≥ `unlockNext`); the boss once `unitShare` of them reach `bossFrom`. */
    unlockNext: 1,
    bossFrom: 2,
  },
  /** XP from level n to n + 1: base × n^exponent (150 × n²: level 2 at 150 XP, 5 at 4 500, 12 at 75 900). About 1 300 XP an hour. */
  level: {
    base: 150,
    exponent: 2,
    /** Past the last title the number keeps growing under it. */
    titles: ['Débutant', 'Touriste', 'Flâneur', 'Bavard', 'Habitué', 'Parisien', 'Lettré', 'Érudit', 'Virtuose', 'Maître', 'Académicien', 'Immortel'],
  },
  /** New written entries a day in the cross-pack review; unit sessions on the map are not limited by it. */
  newPerDay: 15,
  streak: {
    /** Goal for days before the first recorded change: the default before goals were rescaled. */
    defaultGoal: 50,
    goals: [100, 300, 600],
    /** Roughly how long each goal takes, shown next to it. */
    goalMinutes: { 100: 5, 300: 15, 600: 30 } as Readonly<Record<number, number>>,
    /** Goals before the rescale (30 / 50 / 100 XP) and what they became. */
    oldGoals: { 30: 100, 50: 300, 100: 600 } as Readonly<Record<number, number>>,
    freezeEvery: 7,
    maxFreezes: 2,
  },
  quests: { daily: 3, weekly: 1, dailyReward: 50, weeklyReward: 250 },
  league: {
    tiers: ['Bronze', 'Argent', 'Or', 'Diamant'],
    ghosts: 4,
    bots: 5,
    promote: 3,
    relegate: 2,
    /** Weekly XP the bots are scaled to before there is any history of your own. */
    defaultPace: 250,
    /** Each bot's pace is your median weekly XP times a factor in this range. */
    botFactor: [0.6, 1.5],
  },
  /** A boss without its own config in the unit file. */
  boss: { questions: 10, lives: 3, secondsPerQuestion: 12 },
  /** Optional listening boss: minimal pairs and gap dictations, open at the unit's listening mastery `bossFrom`. */
  listeningBoss: { questions: 10, lives: 3, secondsPerQuestion: 25 },
  /** Sans sous-titres: a session with at least this many listening answers, none replayed. */
  cleanListeningMin: 5,
  /** The combo counter shows from this many correct answers in a row. */
  comboVisibleFrom: 3,
  /** Listening and speaking: separate cards, each opened by the skill before it (read → hear → speak). */
  skills: {
    listening: { requires: 'written', newPerDay: 5, sessionShare: 0.3 },
    speaking: { requires: 'listening', newPerDay: 3, sessionShare: 0.2 },
    /** A first correct listening answer about an entry already known in writing starts at a longer interval. */
    knownStart: { minWrittenMastery: 3, interval: 3 },
  },
} as const;
