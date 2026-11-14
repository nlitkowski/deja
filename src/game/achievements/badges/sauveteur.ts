import type { Achievement } from '../types';

const badge: Achievement = {
  id: 'sauveteur',
  title: 'Sauveteur',
  description: { pl: 'Odpowiedz dobrze na wpis po trzech błędach z rzędu.', fr: 'Réponds juste à un mot après trois erreurs de suite.' },
  icon: '🛟',
  check: (s) => s.rescues >= 1,
};

export default badge;
