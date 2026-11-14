import { describe, expect, it } from 'vitest';
import { defaultState, loadState, migrate, rollDay, saveState, SCHEMA_VERSION } from './storage';

function memoryStore(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

describe('storage', () => {
  it('round-trips state', () => {
    const store = memoryStore();
    const state = { ...defaultState(), daily: { day: '2026-11-14', newIntroduced: 2 } };
    saveState(state, store);
    expect(loadState(store)).toEqual(state);
  });

  it('falls back to defaults on corrupt or unknown data', () => {
    expect(loadState(memoryStore('{not json'))).toEqual(defaultState());
    expect(migrate({ schemaVersion: SCHEMA_VERSION + 1 })).toEqual(defaultState());
    expect(migrate(null)).toEqual(defaultState());
  });

  it('fills missing settings with defaults', () => {
    const s = migrate({ schemaVersion: SCHEMA_VERSION, srs: {}, daily: { day: '', newIntroduced: 0 }, settings: { sound: false } });
    expect(s.settings).toEqual({ ...defaultState().settings, sound: false });
  });

  it('migrates v1 state and keeps progress', () => {
    const card = { ease: 2.5, interval: 1, due: '2026-11-15', reps: 1, lapses: 0, correctTotal: 1, lastReviewed: '2026-11-14' };
    const v1 = {
      schemaVersion: 1,
      srs: { 'p/e': card },
      daily: { day: '2026-11-14', newIntroduced: 1 },
      settings: { dailyGoal: 100, sound: false, vibration: true },
    };
    const s = migrate(v1);
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.srs['p/e']).toEqual(card);
    expect(s.settings).toEqual({ dailyGoal: 100, sound: false, vibration: true, helpLang: 'pl', colorMode: 'system', palette: 'classic' });
  });

  it('keeps the chosen colour mode when adding palettes (v3 → v4)', () => {
    const v3 = { schemaVersion: 3, srs: {}, daily: { day: '', newIntroduced: 0 }, settings: { ...defaultState().settings, theme: 'dark' } };
    const s = migrate(v3);
    expect(s.settings).toMatchObject({ colorMode: 'dark', palette: 'classic' });
    expect(s.settings).not.toHaveProperty('theme');
  });

  it('resets daily counters on a new day', () => {
    const s = { ...defaultState(), daily: { day: '2026-11-13', newIntroduced: 5 } };
    expect(rollDay(s, '2026-11-14').daily).toEqual({ day: '2026-11-14', newIntroduced: 0 });
    expect(rollDay(s, '2026-11-13')).toBe(s);
  });
});
