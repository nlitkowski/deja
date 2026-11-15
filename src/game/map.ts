import type { ProgressEvent, SessionKind } from '../lib/progress/events';
import { cardKey, type Skill, type SrsCard } from '../lib/srs';
import { GAME } from './config';
import { entryMastery, unitMastery, type Mastery } from './mastery';

export interface MapUnit {
  key: string;
  /** Without deprecated entries. */
  entryIds: readonly string[];
  /** Does not gate the next unit nor the pack's completion. */
  optional?: boolean;
  /** Has the minimal pairs or gap dictations a listening boss is made of. */
  listeningBoss?: boolean;
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
  /** The second track: never gates anything on the map. */
  listening: {
    /** Some entry has a listening card. */
    started: boolean;
    mastery: Mastery;
    /** Every entry at listening mastery 5: Oreille d'or. */
    golden: boolean;
    /** Absent when the unit has nothing to build a listening boss from. */
    boss?: { unlocked: boolean; defeated: boolean };
  };
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

/** The unit that must be seen before unit `index` opens: the closest earlier one that is not optional. */
export function gatingUnit<U extends { optional?: boolean }>(units: readonly U[], index: number): U | undefined {
  for (let i = index - 1; i >= 0; i--) if (!units[i]!.optional) return units[i];
  return undefined;
}

export function defeatedBosses(events: readonly ProgressEvent[], kind: SessionKind = 'boss'): Set<string> {
  const out = new Set<string>();
  for (const e of events) if (e.type === 'session' && e.kind === kind && e.defeated && e.unitKey) out.add(e.unitKey);
  return out;
}

const goldenIn = (entryIds: readonly string[], cards: Readonly<Record<string, SrsCard>>, skill: Skill = 'written') =>
  entryIds.length > 0 && entryIds.every((id) => entryMastery(cards[cardKey(id, skill)]) === 5);

/**
 * The map's locks. A unit opens once the one before it has every entry seen (mastery ≥ 1); its boss
 * once the unit reaches mastery 2. A pack with `requires` opens once those packs are complete.
 * Optional units are skipped: the unit after one waits for the last required unit before it.
 */
export function mapState(
  packs: readonly MapPack[],
  cards: Readonly<Record<string, SrsCard>>,
  defeated: ReadonlySet<string>,
  defeatedListening: ReadonlySet<string> = new Set(),
): Map<string, PackState> {
  const mastery = new Map(packs.flatMap((p) => p.units.map((u) => [u.key, unitMastery(u.entryIds, cards)] as const)));
  const complete = new Map(packs.map((p) => [p.id, p.units.every((u) => u.optional || mastery.get(u.key)! >= GAME.mastery.unlockNext)]));

  return new Map(
    packs.map((pack) => {
      const missing = pack.requires.filter((id) => !complete.get(id));
      const locked = missing.length > 0;
      const units = pack.units.map((unit, i): UnitState => {
        const m = mastery.get(unit.key)!;
        const previous = gatingUnit(pack.units, i);
        const unitLocked = locked || (!!previous && mastery.get(previous.key)! < GAME.mastery.unlockNext);
        return {
          key: unit.key,
          mastery: m,
          seen: unit.entryIds.filter((id) => cards[cardKey(id)]).length,
          total: unit.entryIds.length,
          locked: unitLocked,
          golden: goldenIn(unit.entryIds, cards),
          boss: { unlocked: !unitLocked && m >= GAME.mastery.bossFrom, defeated: defeated.has(unit.key) },
          listening: listeningState(unit, cards, unitLocked, defeatedListening),
        };
      });
      return [pack.id, { id: pack.id, locked, missing, complete: complete.get(pack.id)!, units }];
    }),
  );
}

function listeningState(unit: MapUnit, cards: Readonly<Record<string, SrsCard>>, unitLocked: boolean, defeated: ReadonlySet<string>): UnitState['listening'] {
  const mastery = unitMastery(unit.entryIds, cards, 'listening');
  return {
    started: unit.entryIds.some((id) => cards[cardKey(id, 'listening')]),
    mastery,
    golden: goldenIn(unit.entryIds, cards, 'listening'),
    boss: unit.listeningBoss ? { unlocked: !unitLocked && mastery >= GAME.mastery.bossFrom, defeated: defeated.has(unit.key) } : undefined,
  };
}
