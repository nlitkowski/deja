import type { Achievement } from '../types';

const badge: Achievement = {
  id: 'premiere-seance',
  title: 'Première séance',
  description: { pl: 'Ukończ pierwszą sesję.', fr: 'Termine ta première séance.' },
  icon: '🎒',
  check: (s) => s.sessions >= 1,
};

export default badge;
