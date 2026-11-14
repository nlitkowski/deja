import { tiers } from '../types';

export default tiers(
  [3, 7, 30, 100],
  (n) => ({
    id: `flamme-${n}`,
    title: `Flamme ${n}`,
    description: { pl: `Utrzymaj płomień przez ${n} dni z rzędu.`, fr: `Garde ta flamme ${n} jours de suite.` },
    icon: '🔥',
  }),
  (s) => s.bestStreak,
);
