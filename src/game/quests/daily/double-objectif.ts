import type { Quest } from '../types';

const quest: Quest = {
  id: 'double-objectif',
  period: 'day',
  title: 'Double ton objectif du jour',
  icon: '🚀',
  target: (d) => 2 * (d.days.at(-1)?.goal ?? 50),
  progress: (d) => d.xp,
};

export default quest;
