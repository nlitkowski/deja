import { useEffect, useMemo } from 'react';
import { content } from '../content/registry';
import { achievementStats, BADGES, bossAchievements, unlockedIds } from '../game/achievements';
import { levelFromXp } from '../game/levels';
import { league } from '../game/league';
import { questStatus } from '../game/quests';
import { heatmap, masteryByPack, weakestEntries } from '../game/stats';
import { goalResolver } from '../game/streak';
import { xpByDay } from '../game/xp';
import { defeatedBosses, mapState, type MapPack } from '../game/map';
import type { Mastery } from '../game/mastery';
import { unitPeaks, type Peaks } from '../game/peaks';
import { browserStore } from '../lib/storage';
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

const listeningBossUnits = new Set(
  [...content.exercises.values()].filter((ex) => ex.type === 'paires-minimales' || ex.type === 'dictee-trous').map((ex) => ex.unitId),
);

const mapPacks: MapPack[] = content.packs
  .filter((p) => p.unitList.length)
  .map((p) => ({
    id: p.id,
    requires: p.requires,
    units: p.unitList.map((u) => ({
      key: u.key,
      optional: u.optional,
      entryIds: u.entryIds.filter((id) => !content.entries.get(id)?.deprecated),
      listeningBoss: listeningBossUnits.has(u.key),
    })),
  }));

const allUnits = mapPacks.flatMap((p) => p.units);

/** Peaks this device has shown: a display memory (not progress), so new entries in a unit do not take a peak back. */
const PEAKS_KEY = 'deja:unit-peaks';

function rememberedPeaks(): Peaks {
  try {
    const saved = JSON.parse(browserStore()?.getItem(PEAKS_KEY) ?? '{}') as Record<string, unknown>;
    return new Map(Object.entries(saved).filter((e): e is [string, Mastery] => typeof e[1] === 'number' && e[1] >= 0 && e[1] <= 5));
  } catch {
    return new Map();
  }
}

function rememberPeaks(peaks: Peaks): void {
  try {
    browserStore()?.setItem(PEAKS_KEY, JSON.stringify(Object.fromEntries([...peaks].filter(([, level]) => level > 0))));
  } catch {
    // Storage full or blocked: the peaks are recomputed from the log next time.
  }
}

/** Highest crown of every unit, from the log and this device's memory. */
export function usePeaks(): Peaks {
  const log = useAppStore((s) => s.log);
  const peaks = useMemo(() => unitPeaks(log, allUnits, rememberedPeaks()), [log]);
  useEffect(() => rememberPeaks(peaks), [peaks]);
  return peaks;
}

/** Locks, mastery and bosses of every unit, by pack id. */
export function useMapState() {
  const cards = useAppStore((s) => s.progress.cards);
  const log = useAppStore((s) => s.log);
  const peaks = usePeaks();
  return useMemo(() => mapState(mapPacks, cards, defeatedBosses(log), defeatedBosses(log, 'boss-listening'), peaks), [cards, log, peaks]);
}

/** Unit key → its state on the map (crowns, peak, locks). */
export function useUnitStates() {
  const map = useMapState();
  return useMemo(() => new Map([...map.values()].flatMap((p) => p.units.map((u) => [u.key, u] as const))), [map]);
}

/** Unit key → whether it is still locked on the map. */
export function useLockedUnits(): ReadonlySet<string> {
  const map = useMapState();
  return useMemo(() => new Set([...map.values()].flatMap((p) => p.units.filter((u) => u.locked).map((u) => u.key))), [map]);
}

/** Every badge: the files in `game/achievements/badges/` plus one per unit boss. */
export const ACHIEVEMENTS = [...BADGES, ...bossAchievements([...content.units.values()].map((u) => ({ key: u.key, title: u.title })))];

export function useAchievements() {
  const cards = useAppStore((s) => s.progress.cards);
  const log = useAppStore((s) => s.log);
  const peaks = usePeaks();
  const today = dayKey(new Date());
  return useMemo(() => {
    const stats = achievementStats(log, { cards, units: allUnits, today, xp: xpContext, peaks });
    return { stats, unlocked: unlockedIds(ACHIEVEMENTS, stats) };
  }, [cards, log, today, peaks]);
}

const questContext = { ...xpContext, isTricky: (entryId: string) => (content.entries.get(entryId)?.confusables.length ?? 0) > 0 };

export function useQuests() {
  const log = useAppStore((s) => s.log);
  const quiet = useAppStore((s) => s.settings.quiet);
  const today = dayKey(new Date());
  return useMemo(() => questStatus(log, today, { ...questContext, quiet }), [log, today, quiet]);
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
