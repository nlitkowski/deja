import type { HelpLang } from '../content/localized';
import type { DayKey } from './date';
import type { SrsCard } from './srs';

/**
 * Settings live in localStorage: small, and index.html must read them synchronously to apply the theme
 * before the first paint. Learning progress lives in the event log (see lib/progress).
 */
export const SCHEMA_VERSION = 6;
export const STORAGE_KEY = 'deja:state';
/** Key used before the app was named Déjà; read once, then removed. */
const LEGACY_KEY = 'revision-francaise:state';

export interface Settings {
  dailyGoal: DailyGoal;
  sound: boolean;
  vibration: boolean;
  helpLang: HelpLang;
  /** `system` follows prefers-color-scheme. */
  colorMode: ColorMode;
  palette: Palette;
  /** Navigation tree hidden on wide screens (on small ones it is always a drawer). */
  navCollapsed: boolean;
  /** Whether the whole sentence is read after an answer: by itself, on a tap, or not offered. */
  readAfter: ReadAfter;
  /** Quiet mode (tram): no listening or speaking cards, nothing read aloud by itself. */
  quiet: boolean;
  /** A new listening card plays its sentence slowly the first time. */
  slowFirst: boolean;
}

export type DailyGoal = 100 | 300 | 600;
export const DAILY_GOALS: readonly DailyGoal[] = [100, 300, 600];
/** Goals before v6 (30 / 50 / 100 XP), each to the one that takes about as long now. */
const RESCALED_GOALS: Readonly<Record<number, DailyGoal>> = { 30: 100, 50: 300, 100: 600 };

/** A goal from any version: kept when valid, rescaled when from before v6 (`old`), else the default. */
export function normalizeGoal(value: unknown, old = false): DailyGoal {
  if (typeof value !== 'number') return defaultSettings().dailyGoal;
  if (old && RESCALED_GOALS[value]) return RESCALED_GOALS[value];
  if ((DAILY_GOALS as readonly number[]).includes(value)) return value as DailyGoal;
  return RESCALED_GOALS[value] ?? defaultSettings().dailyGoal;
}

export type ReadAfter = 'auto' | 'manual' | 'never';
export const READ_AFTER: readonly ReadAfter[] = ['auto', 'manual', 'never'];

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
  /** Set when v6 rescaled the daily goal: the change must go into the log as a setting event, then be saved. */
  goalRescaled?: { from: number; to: DailyGoal };
}

export function defaultSettings(): Settings {
  return { dailyGoal: 300, sound: true, vibration: true, helpLang: 'pl', colorMode: 'system', palette: 'classic', navCollapsed: false, readAfter: 'auto', quiet: false, slowFirst: true };
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
  5: (s) => {
    const settings = (s.settings ?? {}) as { dailyGoal?: unknown };
    return { ...s, schemaVersion: 6, settings: { ...settings, dailyGoal: normalizeGoal(settings.dailyGoal ?? 50, true) } };
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

  const fromGoal = version > 0 && version < 6 ? ((state.settings as { dailyGoal?: number } | undefined)?.dailyGoal ?? 50) : undefined;
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) return { state: defaultState(), legacy };
    state = step(state);
    version += 1;
  }
  const settings = { ...defaultSettings(), ...(state as Partial<SavedState>).settings };
  const goalRescaled = fromGoal !== undefined ? { from: fromGoal, to: settings.dailyGoal } : undefined;
  return { state: { schemaVersion: SCHEMA_VERSION, settings }, legacy, goalRescaled };
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
