import type { Quest } from '../types';

const quest: Quest = {
  id: 'pieges',
  period: 'day',
  title: 'Déjoue 8 pièges (mots qui se confondent)',
  icon: '🪤',
  target: () => 8,
  progress: (d) => d.reviews.filter((r) => r.event.correct && r.event.entryIds.some(d.isTricky)).length,
};

export default quest;
