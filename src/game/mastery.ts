import { cardKey, type Skill, type SrsCard } from '../lib/srs';
import { GAME } from './config';

export type Mastery = 0 | 1 | 2 | 3 | 4 | 5;

/** 0 unknown, 1 seen, then by interval: 2 from 3 days, 3 from 7, 4 from 21, 5 from 60 with at least 4 good answers in a row. */
export function entryMastery(card: SrsCard | undefined): Mastery {
  if (!card) return 0;
  const { intervals, goldReps } = GAME.mastery;
  if (card.interval >= intervals[3] && card.reps >= goldReps) return 5;
  if (card.interval >= intervals[2]) return 4;
  if (card.interval >= intervals[1]) return 3;
  if (card.interval >= intervals[0]) return 2;
  return 1;
}

export const skillMastery = (cards: Readonly<Record<string, SrsCard>>, entryId: string, skill: Skill): Mastery =>
  entryMastery(cards[cardKey(entryId, skill)]);

/**
 * The weakest entry decides: a unit is only as mastered as its least known entry.
 * Unlocks, bosses and gold use the written skill, so listening and speaking never close the map.
 */
export function unitMastery(entryIds: readonly string[], cards: Readonly<Record<string, SrsCard>>, skill: Skill = 'written'): Mastery {
  if (!entryIds.length) return 0;
  return Math.min(...entryIds.map((id) => skillMastery(cards, id, skill))) as Mastery;
}
