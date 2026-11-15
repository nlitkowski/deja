import type { ProgressEvent, SessionKind } from '../lib/progress/events';
import { cardKey, type Skill, type SrsCard } from '../lib/srs';
import { GAME } from './config';
import { entriesBelow, entryMastery, mostAtLeast, unitMastery, type Mastery } from './mastery';

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
  /** The crown now. */
  mastery: Mastery;
  /** The highest crown the unit ever had (never below `mastery`): faded crowns between the two. */
  peak: Mastery;
  /** Below its peak: the entries that keep the crown down, weakest first. */
  refresh: string[];
  seen: number;
  total: number;
  locked: boolean;
  /** Maîtrisé: the unit once reached crown 5, and keeps the title. */
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

/** Every entry seen: what opens the next unit. Kept apart from the crown so its 80% rule does not loosen unlocks. */
export const allSeen = (entryIds: readonly string[], cards: Readonly<Record<string, SrsCard>>) =>
  entryIds.length > 0 && entryIds.every((id) => entryMastery(cards[cardKey(id)]) >= GAME.mastery.unlockNext);

/**
 * The map's locks. A unit opens once the one before it has every entry seen (mastery ≥ 1); its boss
 * once most of its entries reach mastery 2. A pack with `requires` opens once those packs are complete.
 * Optional units are skipped: the unit after one waits for the last required unit before it.
 * `peaks`: the highest crown each unit ever had (see `unitPeaks`).
 */
export function mapState(
  packs: readonly MapPack[],
  cards: Readonly<Record<string, SrsCard>>,
  defeated: ReadonlySet<string>,
  defeatedListening: ReadonlySet<string> = new Set(),
  peaks: ReadonlyMap<string, Mastery> = new Map(),
): Map<string, PackState> {
  const seen = new Map(packs.flatMap((p) => p.units.map((u) => [u.key, allSeen(u.entryIds, cards)] as const)));
  const complete = new Map(packs.map((p) => [p.id, p.units.every((u) => u.optional || seen.get(u.key)!)]));

  return new Map(
    packs.map((pack) => {
      const missing = pack.requires.filter((id) => !complete.get(id));
      const locked = missing.length > 0;
      const units = pack.units.map((unit, i): UnitState => {
        const m = unitMastery(unit.entryIds, cards);
        const peak = Math.max(m, peaks.get(unit.key) ?? 0) as Mastery;
        const previous = gatingUnit(pack.units, i);
        const unitLocked = locked || (!!previous && !seen.get(previous.key)!);
        return {
          key: unit.key,
          mastery: m,
          peak,
          refresh: peak > m ? entriesBelow(unit.entryIds, cards, peak) : [],
          seen: unit.entryIds.filter((id) => cards[cardKey(id)]).length,
          total: unit.entryIds.length,
          locked: unitLocked,
          golden: peak === 5,
          boss: { unlocked: !unitLocked && mostAtLeast(unit.entryIds, cards, GAME.mastery.bossFrom), defeated: defeated.has(unit.key) },
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
    boss: unit.listeningBoss
      ? { unlocked: !unitLocked && mostAtLeast(unit.entryIds, cards, GAME.mastery.bossFrom, 'listening'), defeated: defeated.has(unit.key) }
      : undefined,
  };
}
