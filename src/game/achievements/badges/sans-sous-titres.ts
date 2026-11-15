import { GAME } from '../../config';
import type { Achievement } from '../types';

const badge: Achievement = {
  id: 'sans-sous-titres',
  title: 'Sans sous-titres',
  description: {
    pl: `Ukończ sesję z co najmniej ${GAME.cleanListeningMin} ćwiczeniami ze słuchu, nie odtwarzając niczego ponownie ani wolniej.`,
    fr: `Termine une séance d’au moins ${GAME.cleanListeningMin} exercices d’écoute sans rien réécouter ni ralentir.`,
  },
  icon: '🎬',
  check: (s) => s.cleanListeningSessions >= 1,
};

export default badge;
