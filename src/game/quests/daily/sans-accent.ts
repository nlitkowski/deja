import type { Quest } from '../types';

const quest: Quest = {
  id: 'sans-accent',
  period: 'day',
  title: '15 bonnes réponses sans accent oublié',
  icon: '🎯',
  target: () => 15,
  progress: (d) => d.reviews.filter((r) => r.event.correct && !r.event.nearMiss).length,
};

export default quest;
