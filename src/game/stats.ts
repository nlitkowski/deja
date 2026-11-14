import { addDays, type DayKey } from '../lib/date';
import { cardKey, SRS, type SrsCard } from '../lib/srs';
import type { MapPack } from './map';
import { entryMastery } from './mastery';
import { weekStart } from './quests';

export interface HeatDay {
  day: DayKey;
  xp: number;
  /** 0 nothing, 1 under half the goal, 2 under the goal, 3 goal met, 4 twice the goal. */
  level: 0 | 1 | 2 | 3 | 4;
}

/** Columns of weeks (Monday first), the last one holding today; days after today are left out. */
export function heatmap(xpOn: ReadonlyMap<DayKey, number>, goalOn: (day: DayKey) => number, today: DayKey, weeks = 26): HeatDay[][] {
  const first = addDays(weekStart(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d))
      .filter((day) => day <= today)
      .map((day) => {
        const xp = xpOn.get(day) ?? 0;
        const goal = goalOn(day);
        const level = xp <= 0 ? 0 : xp < goal / 2 ? 1 : xp < goal ? 2 : xp < goal * 2 ? 3 : 4;
        return { day, xp, level };
      }),
  );
}

/** Seen entries that went wrong most often, then the hardest (lowest ease). */
export function weakestEntries(entryIds: readonly string[], cards: Readonly<Record<string, SrsCard>>, limit = 10): string[] {
  return entryIds
    .filter((id) => {
      const card = cards[cardKey(id)];
      return card && (card.lapses > 0 || card.ease < SRS.startEase);
    })
    .sort((a, b) => {
      const ca = cards[cardKey(a)]!;
      const cb = cards[cardKey(b)]!;
      return cb.lapses - ca.lapses || ca.ease - cb.ease || a.localeCompare(b);
    })
    .slice(0, limit);
}

/** How many entries of each pack sit at each mastery level, 0 to 5. */
export function masteryByPack(packs: readonly MapPack[], cards: Readonly<Record<string, SrsCard>>): Map<string, number[]> {
  return new Map(
    packs.map((pack) => {
      const counts = [0, 0, 0, 0, 0, 0];
      for (const unit of pack.units) for (const id of unit.entryIds) counts[entryMastery(cards[cardKey(id)])]! += 1;
      return [pack.id, counts];
    }),
  );
}
