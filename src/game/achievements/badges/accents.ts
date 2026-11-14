import type { Achievement } from '../types';

const badge: Achievement = {
  id: 'pas-d-accent-manquant',
  title: 'Pas d’accent manquant',
  description: { pl: '50 poprawnych odpowiedzi z rzędu bez zgubionego akcentu.', fr: '50 bonnes réponses de suite sans oublier un accent.' },
  icon: '🎯',
  check: (s) => s.accentRun >= 50,
  progress: (s) => [Math.min(s.accentRun, 50), 50],
};

export default badge;
