import type { Quest } from '../types';

const quest: Quest = {
  id: 'trois-seances',
  period: 'day',
  title: 'Termine 3 séances',
  icon: '📚',
  target: () => 3,
  progress: (d) => d.sessions.length,
};

export default quest;
