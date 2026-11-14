import type { Achievement } from '../types';

const badge: Achievement = {
  id: 'leve-tot',
  title: 'Lève-tôt',
  description: { pl: 'Ukończ sesję przed 7:00.', fr: 'Termine une séance avant 7 h.' },
  icon: '🐓',
  check: (s) => s.earlySessions >= 1,
};

export default badge;
