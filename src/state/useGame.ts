import { useMemo } from 'react';
import { content } from '../content/registry';
import { levelFromXp } from '../game/levels';
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
    units: p.unitList.map((u) => ({ key: u.key, entryIds: u.entryIds.filter((id) => !content.entries.get(id)?.deprecated) })),
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
