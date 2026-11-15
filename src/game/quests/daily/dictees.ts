import type { Quest } from '../types';

const TARGET = 5;

const quietFallback: Quest = {
  id: 'trous-sans-faute',
  period: 'day',
  title: `${TARGET} phrases à trous sans faute`,
  icon: '📝',
  target: () => TARGET,
  progress: (d) => d.reviews.filter((r) => r.event.correct && !r.event.nearMiss && d.exerciseType(r.event.exerciseId) === 'gap-fill').length,
};

const quest: Quest = {
  id: 'dictees',
  period: 'day',
  title: `${TARGET} dictées sans faute`,
  icon: '🎼',
  target: () => TARGET,
  progress: (d) => d.reviews.filter((r) => r.event.correct && !r.event.nearMiss && d.exerciseType(r.event.exerciseId)?.startsWith('dictee')).length,
  quietFallback,
};

export default quest;
