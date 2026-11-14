import { tiers } from '../types';

const names: Record<number, string> = { 100: 'Cent bonnes réponses', 500: 'Cinq cents bonnes réponses', 1000: 'Mille bonnes réponses' };

export default tiers(
  [100, 500, 1000],
  (n) => ({
    id: `bonnes-reponses-${n}`,
    title: names[n]!,
    description: { pl: `Udziel ${n} poprawnych odpowiedzi.`, fr: `Donne ${n} bonnes réponses.` },
    icon: n >= 1000 ? '🏆' : n >= 500 ? '🥈' : '🥉',
  }),
  (s) => s.correct,
);
