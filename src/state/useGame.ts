import { useMemo } from 'react';
import { content } from '../content/registry';
import { achievementStats, BADGES, bossAchievements, unlockedIds } from '../game/achievements';
import { levelFromXp } from '../game/levels';
import { league } from '../game/league';
import { questStatus } from '../game/quests';
import { heatmap, masteryByPack, weakestEntries } from '../game/stats';
import { goalResolver } from '../game/streak';
import { xpByDay } from '../game/xp';
import { defeatedBosses, mapState, type MapPack } from '../game/map';
import { streakInfo } from '../game/streak';
import { totalXp } from '../game/xp';
import { dayKey } from '../lib/date';
import { xpContext } from '../xpContext';
import { useAppStore } from './appStore';

/** XP, level and streak derived from the event log, for today. */
export function useGame() {
  const log = useAppStore((s) => s.log);
  const today = dayKey(new Date());
  return useMemo(() => {
    const xp = totalXp(log, xpContext);
    return { xp, level: levelFromXp(xp), streak: streakInfo(log, today, xpContext) };
  }, [log, today]);
}

const mapPacks: MapPack[] = content.packs
  .filter((p) => p.unitList.length)
  .map((p) => ({
    id: p.id,
    requires: p.requires,
    units: p.unitList.map((u) => ({ key: u.key, optional: u.optional, entryIds: u.entryIds.filter((id) => !content.entries.get(id)?.deprecated) })),
  }));

/** Locks, mastery and bosses of every unit, by pack id. */
export function useMapState() {
  const cards = useAppStore((s) => s.progress.cards);
  const log = useAppStore((s) => s.log);
  return useMemo(() => mapState(mapPacks, cards, defeatedBosses(log)), [cards, log]);
}

/** Unit key → whether it is still locked on the map. */
export function useLockedUnits(): ReadonlySet<string> {
  const map = useMapState();
  return useMemo(() => new Set([...map.values()].flatMap((p) => p.units.filter((u) => u.locked).map((u) => u.key))), [map]);
}

/** Every badge: the files in `game/achievements/badges/` plus one per unit boss. */
export const ACHIEVEMENTS = [...BADGES, ...bossAchievements([...content.units.values()].map((u) => ({ key: u.key, title: u.title })))];

const allUnits = mapPacks.flatMap((p) => p.units);

export function useAchievements() {
  const cards = useAppStore((s) => s.progress.cards);
  const log = useAppStore((s) => s.log);
  const today = dayKey(new Date());
  return useMemo(() => {
    const stats = achievementStats(log, { cards, units: allUnits, today, xp: xpContext });
    return { stats, unlocked: unlockedIds(ACHIEVEMENTS, stats) };
  }, [cards, log, today]);
}

const questContext = { ...xpContext, isTricky: (entryId: string) => (content.entries.get(entryId)?.confusables.length ?? 0) > 0 };

export function useQuests() {
  const log = useAppStore((s) => s.log);
  const today = dayKey(new Date());
  return useMemo(() => questStatus(log, today, questContext), [log, today]);
}

export function useLeague() {
  const log = useAppStore((s) => s.log);
  const today = dayKey(new Date());
  return useMemo(() => league(log, today, xpContext), [log, today]);
}

const allEntryIds = allUnits.flatMap((u) => u.entryIds);

export function useStats() {
  const log = useAppStore((s) => s.log);
  const cards = useAppStore((s) => s.progress.cards);
  const today = dayKey(new Date());
  return useMemo(
    () => ({
      heatmap: heatmap(xpByDay(log, xpContext), goalResolver(log), today),
      weakest: weakestEntries(allEntryIds, cards),
      mastery: masteryByPack(mapPacks, cards),
    }),
    [log, cards, today],
  );
}
