import type { Quest } from '../types';

const quest: Quest = {
  id: 'objectif-5-jours',
  period: 'week',
  title: 'Atteins ton objectif 5 jours',
  icon: '📅',
  target: () => 5,
  progress: (d) => d.days.filter((day) => day.xp >= day.goal).length,
};

export default quest;
