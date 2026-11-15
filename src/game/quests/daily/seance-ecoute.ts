import { reviewSkill } from '../../../lib/progress/events';
import type { Quest } from '../types';

const MIN_LISTENING = 3;

const quietFallback: Quest = {
  id: 'longue-seance',
  period: 'day',
  title: 'Une séance de 15 cartes',
  icon: '📚',
  target: () => 1,
  progress: (d) => d.sessions.filter((s) => s.items >= 15).length,
};

const quest: Quest = {
  id: 'seance-ecoute',
  period: 'day',
  title: 'Une séance avec de l’écoute',
  icon: '🎧',
  target: () => 1,
  progress: (d) =>
    d.sessions.filter((s) => d.reviews.filter((r) => r.event.sessionId === s.sessionId && reviewSkill(r.event) === 'listening').length >= MIN_LISTENING)
      .length,
  quietFallback,
};

export default quest;
