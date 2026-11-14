import type { Quest } from '../types';

const quest: Quest = {
  id: 'combo-10',
  period: 'day',
  title: '10 bonnes réponses de suite',
  icon: '⚡',
  target: () => 10,
  progress: (d) => Math.max(0, ...d.reviews.filter((r) => r.event.correct).map((r) => (r.event.comboBefore ?? 0) + 1)),
};

export default quest;
