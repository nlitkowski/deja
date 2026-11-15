import { cardKey, type Skill, type SrsCard } from '../lib/srs';
import { GAME } from './config';

export type Mastery = 0 | 1 | 2 | 3 | 4 | 5;

/** 0 unknown, 1 seen, then by interval: 2 from 3 days, 3 from 7, 4 from 20, 5 from 60 with at least 4 good answers in a row. */
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

const atLeast = (levels: readonly number[], level: number) => levels.filter((m) => m >= level).length;
/** How many of `n` entries make the share (80% of 20 = 16), without float surprises. */
const shareOf = (n: number) => Math.ceil(n * GAME.mastery.unitShare - 1e-9);

/**
 * A unit's crown: the highest level L that most of its entries reach (`unitShare`) while none lags far behind
 * (`unitMaxGap`), so one mistake does not drop a unit from 4 to 1.
 */
export function crownOf(levels: readonly Mastery[]): Mastery {
  if (!levels.length) return 0;
  const min = Math.min(...levels);
  for (let level = 5; level > 0; level--) {
    if (atLeast(levels, level) >= shareOf(levels.length) && min >= level - GAME.mastery.unitMaxGap) return level as Mastery;
  }
  return 0;
}

/** Unlocks, bosses and gold use the written skill, so listening and speaking never close the map. */
export function unitMastery(entryIds: readonly string[], cards: Readonly<Record<string, SrsCard>>, skill: Skill = 'written'): Mastery {
  return crownOf(entryIds.map((id) => skillMastery(cards, id, skill)));
}

/** Whether `unitShare` of the entries reach `level` (the boss opens at `bossFrom`). */
export function mostAtLeast(entryIds: readonly string[], cards: Readonly<Record<string, SrsCard>>, level: number, skill: Skill = 'written'): boolean {
  return entryIds.length > 0 && atLeast(entryIds.map((id) => skillMastery(cards, id, skill)), level) >= shareOf(entryIds.length);
}

/**
 * The entries that keep the crown below `target`: every one too far behind, then the closest of the rest
 * below `target` until enough reach it. Weakest first.
 */
export function entriesBelow(entryIds: readonly string[], cards: Readonly<Record<string, SrsCard>>, target: Mastery): string[] {
  const levels = entryIds.map((id) => ({ id, m: skillMastery(cards, id, 'written') }));
  const lagging = levels.filter((e) => e.m < target - GAME.mastery.unitMaxGap);
  const short = Math.max(0, shareOf(levels.length) - atLeast(levels.map((e) => e.m), target));
  const lagIds = new Set(lagging.map((e) => e.id));
  // Lagging entries raised to the gap's floor still fall short of `target`, so they never count toward the share.
  const closest = levels
    .filter((e) => e.m < target && !lagIds.has(e.id))
    .sort((a, b) => b.m - a.m)
    .slice(0, Math.max(0, short));
  return [...lagging, ...closest].sort((a, b) => a.m - b.m).map((e) => e.id);
}
