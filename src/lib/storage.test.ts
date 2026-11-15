import { describe, expect, it } from 'vitest';
import { defaultSettings, defaultState, deviceId, loadState, migrate, saveState, SCHEMA_VERSION, STORAGE_KEY, type Settings } from './storage';

function memoryStore(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, next: string) => void values.set(key, next),
    removeItem: (key: string) => void values.delete(key),
    keys: () => [...values.keys()],
  };
}

const card = { ease: 2.5, interval: 1, due: '2026-11-15', reps: 1, lapses: 0, correctTotal: 1, lastReviewed: '2026-11-14' };

describe('storage', () => {
  it('round-trips settings', () => {
    const store = memoryStore();
    const state = { ...defaultState(), settings: { ...defaultSettings(), palette: 'pixel' as const } };
    saveState(state, store);
    expect(loadState(store)).toEqual({ state });
  });

  it('falls back to defaults on corrupt or unknown data', () => {
    expect(loadState(memoryStore({ [STORAGE_KEY]: '{not json' })).state).toEqual(defaultState());
    expect(migrate({ schemaVersion: SCHEMA_VERSION + 1 }).state).toEqual(defaultState());
    expect(migrate(null).state).toEqual(defaultState());
  });

  it('fills missing settings with defaults', () => {
    expect(migrate({ schemaVersion: SCHEMA_VERSION, settings: { sound: false } }).state.settings).toEqual({ ...defaultSettings(), sound: false });
  });

  it('migrates v1 settings and hands old progress out as legacy', () => {
    const v1 = {
      schemaVersion: 1,
      srs: { 'p/e': card },
      daily: { day: '2026-11-14', newIntroduced: 1 },
      settings: { dailyGoal: 100, sound: false, vibration: true },
    };
    const { state, legacy } = migrate(v1);
    // The old 100 XP goal became 600 XP in v6.
    expect(state).toEqual({ schemaVersion: SCHEMA_VERSION, settings: { ...defaultSettings(), dailyGoal: 600, sound: false } });
    expect(legacy).toEqual({ srs: { 'p/e': card }, daily: { day: '2026-11-14', newIntroduced: 1 } });
  });

  it('rescales daily goals in v6: 30 → 100, 50 → 300, 100 → 600, and reports it', () => {
    const v5 = (dailyGoal?: number) => ({ schemaVersion: 5, settings: { ...defaultSettings(), dailyGoal } });
    expect([30, 50, 100].map((g) => migrate(v5(g)).state.settings.dailyGoal)).toEqual([100, 300, 600]);
    expect(migrate(v5(50)).goalRescaled).toEqual({ from: 50, to: 300 });
    expect(migrate(v5(undefined)).goalRescaled).toEqual({ from: 50, to: 300 });
    expect(migrate({ schemaVersion: 6, settings: defaultSettings() }).goalRescaled).toBeUndefined();
    expect(defaultSettings().dailyGoal).toBe(300);
  });

  it('keeps the chosen colour mode when adding palettes (v3 → v4)', () => {
    const v3 = { schemaVersion: 3, srs: {}, daily: { day: '', newIntroduced: 0 }, settings: { ...defaultSettings(), theme: 'dark' } };
    const { state, legacy } = migrate(v3);
    expect(state.settings).toMatchObject({ colorMode: 'dark', palette: 'classic' });
    expect(state.settings).not.toHaveProperty('theme');
    expect(legacy).toBeUndefined();
  });

  it('reads the pre-Déjà key and drops it on save', () => {
    const v4 = { schemaVersion: 4, srs: { 'p/e': card }, daily: { day: '2026-11-14', newIntroduced: 3 }, settings: defaultSettings() };
    const store = memoryStore({ 'revision-francaise:state': JSON.stringify(v4) });
    const loaded = loadState(store);
    expect(loaded.legacy?.srs).toEqual({ 'p/e': card });
    saveState(loaded.state, store);
    expect(store.keys()).toEqual([STORAGE_KEY]);
    expect(loadState(store).legacy).toBeUndefined();
  });

  it('adds new settings with their defaults to saved v5 state', () => {
    const older: Partial<Settings> = defaultSettings();
    delete older.navCollapsed;
    expect(migrate({ schemaVersion: SCHEMA_VERSION, settings: { ...older, palette: 'pixel' } }).state.settings).toEqual({
      ...defaultSettings(),
      palette: 'pixel',
    });
  });

  it('keeps one device id per browser', () => {
    const store = memoryStore();
    expect(deviceId(store)).toBe(deviceId(store));
  });
});
