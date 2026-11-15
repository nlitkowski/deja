import type { Quest } from '../types';

const quest: Quest = {
  id: 'vingt-ecrites',
  period: 'day',
  title: 'Écris 20 bonnes réponses',
  icon: '🔤',
  target: () => 20,
  progress: (d) => d.reviews.filter((r) => r.event.correct && (r.event.production ?? d.isProduction(r.event.exerciseId))).length,
};

export default quest;
