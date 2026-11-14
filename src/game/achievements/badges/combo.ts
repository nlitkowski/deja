import { tiers } from '../types';

export default tiers(
  [10, 25, 50],
  (n) => ({
    id: `combo-${n}`,
    title: `Combo ${n}`,
    description: { pl: `${n} poprawnych odpowiedzi z rzędu w jednej sesji.`, fr: `${n} bonnes réponses de suite dans une séance.` },
    icon: '⚡',
  }),
  (s) => s.maxCombo,
);
