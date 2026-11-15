import type { Achievement } from '../types';

const TARGET = 50;

const badge: Achievement = {
  id: 'oreille-fine',
  title: 'Oreille fine',
  description: { pl: `${TARGET} dyktand bez jednego błędu, z akcentami.`, fr: `${TARGET} dictées sans aucune faute, accents compris.` },
  icon: '🎼',
  check: (s) => s.cleanDictations >= TARGET,
  progress: (s) => [Math.min(s.cleanDictations, TARGET), TARGET],
};

export default badge;
