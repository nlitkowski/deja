import type { Achievement } from '../types';

const badge: Achievement = {
  id: 'maitrise',
  title: 'Maîtrisé',
  description: { pl: 'Doprowadź wszystkie wpisy jednej jednostki do najwyższego poziomu.', fr: 'Amène tous les mots d’une unité au plus haut niveau.' },
  icon: '👑',
  check: (s) => s.goldenUnits >= 1,
};

export default badge;
