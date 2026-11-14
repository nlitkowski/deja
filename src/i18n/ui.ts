/** Interface strings. Learning content lives in `content/`, not here. */
export const ui = {
  appTitle: 'Français A1',
  appSubtitle: 'Révisions : connecteurs, prépositions et plus encore',

  dueCount: (n: number) => (n <= 1 ? 'entrée à réviser' : 'entrées à réviser'),
  newToday: (n: number, max: number) => `Nouvelles aujourd’hui : ${n} / ${max}`,
  review: 'Révision',
  reviewWithCount: (n: number) => `Révision (${n})`,
  allDoneToday: 'Tout est fait pour aujourd’hui',
  unitSeen: (seen: number, total: number) => `${seen}/${total} découvertes`,
  unitDue: (n: number) => `${n} à réviser`,
  unitProgressLabel: (seen: number, total: number) => `Découvertes : ${seen} sur ${total}`,

  helpLangLabel: 'Aides',
  helpLangNames: { pl: 'polonais', fr: 'français' },

  closeSession: 'Quitter la séance',
  cardOf: (i: number, n: number) => `Carte ${i} sur ${n}`,
  noCards: 'Aucune carte dans cette séance.',
  back: 'Retour',
  next: 'Suivant',
  correct: '✓ Bravo !',
  nearMiss: 'Presque ! Attention à l’accent',
  wrong: 'Pas tout à fait',
  answerWas: 'La réponse',
  correctAnswer: 'Bonne réponse :',
  yourAnswer: 'Ta réponse :',

  typePlaceholder: 'Écris ta réponse…',
  answerLabel: 'Ta réponse',
  showHint: '💡 Indice',
  dontKnow: 'Je ne sais pas',
  check: 'Vérifier',
  accentBarLabel: 'Caractères accentués',
  translateToFrench: 'Traduis en français',

  sessionDone: 'Séance terminée !',
  percentCorrect: 'de bonnes réponses',
  answers: 'réponses',
  entriesReviewed: 'entrées révisées',
  accentsMissed: 'accents oubliés',
  backToMap: 'Retour à la carte',
} as const;
