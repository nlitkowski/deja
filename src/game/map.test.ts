import { describe, expect, it } from 'vitest';
import type { SrsCard } from '../lib/srs';
import { defeatedBosses, mapState, type MapPack } from './map';
import { session } from './testEvents';

const card = (interval: number, reps = 1): SrsCard => ({ ease: 2.5, interval, due: '2026-12-01', reps, lapses: 0, correctTotal: reps, lastReviewed: '2026-11-14' });

const packs: MapPack[] = [
  { id: 'a', requires: [], units: [{ key: 'a/1', entryIds: ['a1', 'a2'] }, { key: 'a/2', entryIds: ['a3'] }, { key: 'a/3', entryIds: ['a4'] }] },
  { id: 'b', requires: ['a'], units: [{ key: 'b/1', entryIds: ['b1'] }] },
];

describe('mapState', () => {
  it('opens only the first unit at the start, and locks packs with requirements', () => {
    const state = mapState(packs, {}, new Set());
    expect(state.get('a')!.units.map((u) => u.locked)).toEqual([false, true, true]);
    expect(state.get('b')).toMatchObject({ locked: true, missing: ['a'] });
    expect(state.get('a')!.units[0]!.boss.unlocked).toBe(false);
  });

  it('opens the next unit once every entry of this one was seen, and the boss from mastery 2', () => {
    const half = mapState(packs, { a1: card(1) }, new Set()).get('a')!;
    expect(half.units[0]).toMatchObject({ mastery: 0, seen: 1, total: 2 });
    expect(half.units[1]!.locked).toBe(true);

    const seen = mapState(packs, { a1: card(1), a2: card(1) }, new Set()).get('a')!;
    expect(seen.units.map((u) => u.locked)).toEqual([false, false, true]);
    expect(seen.units[0]!.boss.unlocked).toBe(false);

    const solid = mapState(packs, { a1: card(3), a2: card(8) }, new Set(['a/1'])).get('a')!;
    expect(solid.units[0]).toMatchObject({ mastery: 2, boss: { unlocked: true, defeated: true } });
  });

  it('opens a pack once its required pack is complete, and marks golden units', () => {
    const gold = card(90, 5);
    const state = mapState(packs, { a1: gold, a2: gold, a3: card(1), a4: card(1) }, new Set());
    expect(state.get('a')).toMatchObject({ complete: true });
    expect(state.get('a')!.units[0]!.golden).toBe(true);
    expect(state.get('a')!.units[1]!.golden).toBe(false);
    expect(state.get('b')).toMatchObject({ locked: false, missing: [] });
  });

  it('an optional unit locks nothing: the next unit and the pack do not wait for it', () => {
    const intro: MapPack[] = [
      { id: 'a', requires: [], units: [{ key: 'a/0', entryIds: ['a0'], optional: true }, { key: 'a/1', entryIds: ['a1'] }, { key: 'a/2', entryIds: ['a2'] }] },
      { id: 'b', requires: ['a'], units: [{ key: 'b/1', entryIds: ['b1'] }] },
    ];
    expect(mapState(intro, {}, new Set()).get('a')!.units.map((u) => u.locked)).toEqual([false, false, true]);
    const state = mapState(intro, { a1: card(1), a2: card(1) }, new Set());
    expect(state.get('a')).toMatchObject({ complete: true });
    expect(state.get('b')!.locked).toBe(false);
  });
});

describe('defeatedBosses', () => {
  it('collects units whose boss was won at least once', () => {
    const events = [
      session({ kind: 'boss', unitKey: 'a/1', defeated: false }),
      session({ kind: 'boss', unitKey: 'a/2', defeated: true }),
      session({ kind: 'unit', unitKey: 'a/3' }),
    ];
    expect([...defeatedBosses(events)]).toEqual(['a/2']);
  });
});
