import type { ProgressEvent } from '../lib/progress/events';
import { cardKey, type SrsCard } from '../lib/srs';
import { GAME } from './config';
import { entryMastery, unitMastery, type Mastery } from './mastery';

export interface MapUnit {
  key: string;
  /** Without deprecated entries. */
  entryIds: readonly string[];
}

export interface MapPack {
  id: string;
  requires: readonly string[];
  units: readonly MapUnit[];
}

export interface UnitState {
  key: string;
  mastery: Mastery;
  seen: number;
  total: number;
  locked: boolean;
  /** Every entry at mastery 5. */
  golden: boolean;
  boss: { unlocked: boolean; defeated: boolean };
}

export interface PackState {
  id: string;
  locked: boolean;
  /** Required packs not completed yet. */
  missing: string[];
  /** Every unit open for the next one (mastery ≥ 1 everywhere). */
  complete: boolean;
  units: UnitState[];
}

export function defeatedBosses(events: readonly ProgressEvent[]): Set<string> {
  const out = new Set<string>();
  for (const e of events) if (e.type === 'session' && e.kind === 'boss' && e.defeated && e.unitKey) out.add(e.unitKey);
  return out;
}

/**
 * The map's locks. A unit opens once the one before it has every entry seen (mastery ≥ 1); its boss
 * once the unit reaches mastery 2. A pack with `requires` opens once those packs are complete.
 */
export function mapState(packs: readonly MapPack[], cards: Readonly<Record<string, SrsCard>>, defeated: ReadonlySet<string>): Map<string, PackState> {
  const mastery = new Map(packs.flatMap((p) => p.units.map((u) => [u.key, unitMastery(u.entryIds, cards)] as const)));
  const complete = new Map(packs.map((p) => [p.id, p.units.every((u) => mastery.get(u.key)! >= GAME.mastery.unlockNext)]));

  return new Map(
    packs.map((pack) => {
      const missing = pack.requires.filter((id) => !complete.get(id));
      const locked = missing.length > 0;
      const units = pack.units.map((unit, i): UnitState => {
        const m = mastery.get(unit.key)!;
        const previous = pack.units[i - 1];
        const unitLocked = locked || (!!previous && mastery.get(previous.key)! < GAME.mastery.unlockNext);
        return {
          key: unit.key,
          mastery: m,
          seen: unit.entryIds.filter((id) => cards[cardKey(id)]).length,
          total: unit.entryIds.length,
          locked: unitLocked,
          golden: unit.entryIds.length > 0 && unit.entryIds.every((id) => entryMastery(cards[cardKey(id)]) === 5),
          boss: { unlocked: !unitLocked && m >= GAME.mastery.bossFrom, defeated: defeated.has(unit.key) },
        };
      });
      return [pack.id, { id: pack.id, locked, missing, complete: complete.get(pack.id)!, units }];
    }),
  );
}
