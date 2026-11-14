import type { Quest } from '../types';

const quest: Quest = {
  id: 'quinze-seances',
  period: 'week',
  title: 'Termine 15 séances',
  icon: '🗓️',
  target: () => 15,
  progress: (d) => d.sessions.length,
};

export default quest;
