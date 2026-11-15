import type { Achievement } from '../types';

const badge: Achievement = {
  id: 'premiere-ecoute',
  title: 'Première écoute',
  description: { pl: 'Odpowiedz poprawnie w pierwszym ćwiczeniu ze słuchu.', fr: 'Réussis ton premier exercice d’écoute.' },
  icon: '👂',
  check: (s) => s.listeningCorrect >= 1,
};

export default badge;
