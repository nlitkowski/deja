import type { Quest } from '../types';

const quest: Quest = {
  id: 'cent-bonnes',
  period: 'week',
  title: '100 bonnes réponses cette semaine',
  icon: '🏅',
  target: () => 100,
  progress: (d) => d.reviews.filter((r) => r.event.correct).length,
};

export default quest;
