import type { Achievement } from '../types';

const badge: Achievement = {
  id: 'oiseau-de-nuit',
  title: 'Oiseau de nuit',
  description: { pl: 'Ukończ sesję po 23:00.', fr: 'Termine une séance après 23 h.' },
  icon: '🦉',
  check: (s) => s.nightSessions >= 1,
};

export default badge;
