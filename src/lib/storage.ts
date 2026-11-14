import type { HelpLang } from '../content/localized';
import type { DayKey } from './date';
import type { SrsCard } from './srs';

export const SCHEMA_VERSION = 3;
const KEY = 'revision-francaise:state';

export interface Settings {
  dailyGoal: 30 | 50 | 100;
  sound: boolean;
  vibration: boolean;
  helpLang: HelpLang;
  /** `system` follows prefers-color-scheme. */
  theme: Theme;
}

export type Theme = 'system' | 'light' | 'dark';
export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

export interface SavedState {
  schemaVersion: typeof SCHEMA_VERSION;
  srs: Record<string, SrsCard>;
  daily: { day: DayKey; newIntroduced: number };
  settings: Settings;
}

export function defaultState(): SavedState {
  return {
    schemaVersion: SCHEMA_VERSION,
    srs: {},
    daily: { day: '', newIntroduced: 0 },
    settings: { dailyGoal: 50, sound: true, vibration: true, helpLang: 'pl', theme: 'system' },
  };
}

/** `MIGRATIONS[n]` upgrades a state of version n to n + 1. */
const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  1: (s) => ({ ...s, schemaVersion: 2, settings: { ...(s.settings as object), helpLang: 'pl' } }),
  2: (s) => ({ ...s, schemaVersion: 3, settings: { ...(s.settings as object), theme: 'system' } }),
};

export function migrate(raw: unknown): SavedState {
  if (!raw || typeof raw !== 'object') return defaultState();
  let state = raw as Record<string, unknown>;
  let version = typeof state.schemaVersion === 'number' ? state.schemaVersion : 0;
  if (version > SCHEMA_VERSION) return defaultState();
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return defaultState();
    state = step(state);
    version += 1;
  }
  const base = defaultState();
  const s = state as Partial<SavedState>;
  return {
    schemaVersion: SCHEMA_VERSION,
    srs: s.srs ?? base.srs,
    daily: s.daily ?? base.daily,
    settings: { ...base.settings, ...s.settings },
  };
}

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

function browserStore(): KeyValueStore | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function loadState(store: KeyValueStore | undefined = browserStore()): SavedState {
  try {
    const text = store?.getItem(KEY);
    return text ? migrate(JSON.parse(text)) : defaultState();
  } catch {
    return defaultState();
  }
}

export function saveState(state: SavedState, store: KeyValueStore | undefined = browserStore()): boolean {
  try {
    store?.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/** Resets the per-day counters when the day changed. */
export function rollDay(state: SavedState, today: DayKey): SavedState {
  return state.daily.day === today ? state : { ...state, daily: { day: today, newIntroduced: 0 } };
}
