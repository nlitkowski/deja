import type { HelpLang } from '../content/localized';
import type { DayKey } from './date';
import type { SrsCard } from './srs';

/**
 * Settings live in localStorage: small, and index.html must read them synchronously to apply the theme
 * before the first paint. Learning progress lives in the event log (see lib/progress).
 */
export const SCHEMA_VERSION = 5;
export const STORAGE_KEY = 'deja:state';
/** Key used before the app was named Déjà; read once, then removed. */
const LEGACY_KEY = 'revision-francaise:state';

export interface Settings {
  dailyGoal: 30 | 50 | 100;
  sound: boolean;
  vibration: boolean;
  helpLang: HelpLang;
  /** `system` follows prefers-color-scheme. */
  colorMode: ColorMode;
  palette: Palette;
}

export type ColorMode = 'system' | 'light' | 'dark';
export const COLOR_MODES: readonly ColorMode[] = ['system', 'light', 'dark'];
export type Palette = 'classic' | 'provence' | 'pixel';
export const PALETTES: readonly Palette[] = ['classic', 'provence', 'pixel'];

export interface SavedState {
  schemaVersion: typeof SCHEMA_VERSION;
  settings: Settings;
}

/** Progress stored inside the state blob before v5; turned into a baseline event once. */
export interface LegacyProgress {
  srs: Record<string, SrsCard>;
  daily: { day: DayKey; newIntroduced: number };
}

export interface LoadedState {
  state: SavedState;
  legacy?: LegacyProgress;
}

export function defaultSettings(): Settings {
  return { dailyGoal: 50, sound: true, vibration: true, helpLang: 'pl', colorMode: 'system', palette: 'classic' };
}

export function defaultState(): SavedState {
  return { schemaVersion: SCHEMA_VERSION, settings: defaultSettings() };
}

/** `MIGRATIONS[n]` upgrades a state of version n to n + 1. */
const MIGRATIONS: Record<number, (s: Record<string, unknown>) => Record<string, unknown>> = {
  1: (s) => ({ ...s, schemaVersion: 2, settings: { ...(s.settings as object), helpLang: 'pl' } }),
  2: (s) => ({ ...s, schemaVersion: 3, settings: { ...(s.settings as object), theme: 'system' } }),
  3: (s) => {
    const { theme, ...settings } = s.settings as { theme?: ColorMode };
    return { ...s, schemaVersion: 4, settings: { ...settings, colorMode: theme ?? 'system', palette: 'classic' } };
  },
  // Progress moved to the event log; migrate() hands it out as `legacy` instead of keeping it here.
  4: (s) => {
    const next: Record<string, unknown> = { ...s, schemaVersion: 5 };
    delete next.srs;
    delete next.daily;
    return next;
  },
};

export function migrate(raw: unknown): LoadedState {
  if (!raw || typeof raw !== 'object') return { state: defaultState() };
  let state = raw as Record<string, unknown>;
  let version = typeof state.schemaVersion === 'number' ? state.schemaVersion : 0;
  if (version > SCHEMA_VERSION) return { state: defaultState() };

  const old = state as Partial<LegacyProgress>;
  const legacy =
    version < 5 && old.srs && Object.keys(old.srs).length
      ? { srs: old.srs, daily: old.daily ?? { day: '', newIntroduced: 0 } }
      : undefined;

  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { state: defaultState(), legacy };
    state = step(state);
    version += 1;
  }
  const settings = { ...defaultSettings(), ...(state as Partial<SavedState>).settings };
  return { state: { schemaVersion: SCHEMA_VERSION, settings }, legacy };
}

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function browserStore(): KeyValueStore | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function loadState(store: KeyValueStore | undefined = browserStore()): LoadedState {
  try {
    const text = store?.getItem(STORAGE_KEY) ?? store?.getItem(LEGACY_KEY);
    return text ? migrate(JSON.parse(text)) : { state: defaultState() };
  } catch {
    return { state: defaultState() };
  }
}

/** Writes the v5 shape; call only after any `legacy` progress has been saved to the event log. */
export function saveState(state: SavedState, store: KeyValueStore | undefined = browserStore()): boolean {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(state));
    store?.removeItem(LEGACY_KEY);
    return true;
  } catch {
    return false;
  }
}

const DEVICE_KEY = 'deja:device';

/** Stable per-browser id stamped on events, so logs from several devices can be told apart once synced. */
export function deviceId(store: KeyValueStore | undefined = browserStore()): string {
  try {
    const existing = store?.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    store?.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return 'unknown-device';
  }
}
