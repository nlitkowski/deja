import type { Achievement } from '../types';

const badge: Achievement = {
  id: 'oreille-d-or',
  title: 'Oreille d’or',
  description: { pl: 'Doprowadź całą jednostkę do najwyższego poziomu ze słuchu.', fr: 'Amène toute une unité au niveau maximal à l’écoute.' },
  icon: '🎧',
  check: (s) => s.goldenListeningUnits >= 1,
};

export default badge;
