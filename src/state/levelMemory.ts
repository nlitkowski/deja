import { browserStore, type KeyValueStore } from '../lib/storage';

/**
 * The highest level this device has shown, on the level curve of `CURVE`. When the curve changes, levels
 * are recalculated from the same XP; the first start after that shows a notice instead of a level-up,
 * and level-ups only celebrate levels above the one remembered here.
 */
const KEY = 'deja:level-shown';
const CURVE = 2;

interface Memory {
  curve: number;
  level: number;
}

function read(store: KeyValueStore | undefined): Memory | undefined {
  try {
    const saved = JSON.parse(store?.getItem(KEY) ?? 'null') as Partial<Memory> | null;
    return typeof saved?.curve === 'number' && typeof saved.level === 'number' ? { curve: saved.curve, level: saved.level } : undefined;
  } catch {
    return undefined;
  }
}

function write(store: KeyValueStore | undefined, level: number): void {
  try {
    store?.setItem(KEY, JSON.stringify({ curve: CURVE, level }));
  } catch {
    // Blocked storage: at worst a level-up is celebrated twice.
  }
}

/** Whether the recalculation notice is due: XP earned on an older curve, not yet acknowledged. */
export function levelsRecalculated(xp: number, store = browserStore()): boolean {
  return xp > 0 && read(store)?.curve !== CURVE;
}

/** Remembers the current level as seen, e.g. once the recalculation notice is closed. */
export function acknowledgeLevel(level: number, store = browserStore()): void {
  const memory = read(store);
  write(store, memory?.curve === CURVE ? Math.max(memory.level, level) : level);
}

/** Whether reaching `level` deserves the level-up celebration: only the first time on this device. */
export function isNewLevel(level: number, store = browserStore()): boolean {
  const memory = read(store);
  return memory?.curve !== CURVE || level > memory.level;
}
