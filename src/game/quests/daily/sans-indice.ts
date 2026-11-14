import type { Quest } from '../types';

const quest: Quest = {
  id: 'sans-indice',
  period: 'day',
  title: 'Une séance sans indice',
  icon: '🙈',
  target: () => 1,
  progress: (d) => d.sessions.filter((s) => s.items >= 5 && !d.reviews.some((r) => r.event.sessionId === s.sessionId && r.event.hintUsed)).length,
};

export default quest;
