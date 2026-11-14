import type { Quest } from '../types';

const quest: Quest = {
  id: 'xp-500',
  period: 'week',
  title: 'Gagne 500 XP cette semaine',
  icon: '💎',
  target: () => 500,
  progress: (d) => d.xp,
};

export default quest;
