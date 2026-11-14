import type { Quest } from '../types';

/** A card the learner struggles with: it has lapsed, or its ease has dropped. */
const isWeak = (card: { ease: number; lapses: number }) => card.lapses > 0 || card.ease < 2.3;

const quest: Quest = {
  id: 'points-faibles',
  period: 'day',
  title: 'Renforce 5 points faibles',
  icon: '🩹',
  target: () => 5,
  progress: (d) => d.reviews.filter((r) => r.event.correct && r.before.some(isWeak)).length,
};

export default quest;
