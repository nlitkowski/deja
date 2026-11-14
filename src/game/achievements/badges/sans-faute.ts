import type { Achievement } from '../types';

const badge: Achievement = {
  id: 'sans-faute',
  title: 'Sans faute',
  description: { pl: 'Ukończ sesję z co najmniej 10 kartami bez żadnego błędu.', fr: 'Termine une séance d’au moins 10 cartes sans aucune erreur.' },
  icon: '💯',
  check: (s) => s.perfectSessions >= 1,
};

export default badge;
