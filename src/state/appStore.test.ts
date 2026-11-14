import { describe, expect, it } from 'vitest';
import { memoryStore } from '../lib/progress/store';
import { review } from '../lib/srs';
import { defaultSettings, STORAGE_KEY } from '../lib/storage';
import { createAppStore } from './appStore';

function memoryKv(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => void values.set(k, v),
    removeItem: (k: string) => void values.delete(k),
    raw: (k: string) => values.get(k),
  };
}

const ok = { correct: true, nearMiss: false, hintUsed: false, timeMs: 8000 };

describe('app store', () => {
  it('moves pre-v5 progress into a baseline event, then drops it from localStorage', async () => {
    const card = review(undefined, 'good', '2026-11-10');
    const kv = memoryKv({
      [STORAGE_KEY]: JSON.stringify({ schemaVersion: 4, srs: { 'p/a': card }, daily: { day: '', newIntroduced: 0 }, settings: defaultSettings() }),
    });
    const progressStore = memoryStore();
    const store = createAppStore({ progressStore, kv });
    await store.getState().init();

    expect(store.getState().status).toBe('ready');
    expect(store.getState().progress.cards['p/a']).toEqual(card);
    const events = await progressStore.loadEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'baseline', cards: { 'p/a': card } });
    expect(JSON.parse(kv.raw(STORAGE_KEY)!)).toEqual({ schemaVersion: 5, settings: defaultSettings() });

    // A second start must not import the baseline again.
    const again = createAppStore({ progressStore, kv });
    await again.getState().init();
    expect(await progressStore.loadEvents()).toHaveLength(1);
  });

  it('migrates once even when init runs twice at the same time (StrictMode)', async () => {
    const kv = memoryKv({
      [STORAGE_KEY]: JSON.stringify({ schemaVersion: 4, srs: { 'p/a': review(undefined, 'good', '2026-11-10') }, daily: { day: '', newIntroduced: 0 }, settings: defaultSettings() }),
    });
    const progressStore = memoryStore();
    const store = createAppStore({ progressStore, kv });
    await Promise.all([store.getState().init(), store.getState().init()]);
    expect(await progressStore.loadEvents()).toHaveLength(1);
  });

  it('records answers as events and updates the folded state', async () => {
    const progressStore = memoryStore();
    const store = createAppStore({ progressStore, kv: memoryKv() });
    await store.getState().init();

    const event = store.getState().recordAnswer({ exerciseId: 'p/x', entryIds: ['p/a'], result: ok, early: false }, new Date(2026, 10, 14, 9));
    expect(event).toMatchObject({ type: 'review', day: '2026-11-14', grade: 'good', entryIds: ['p/a'] });
    expect(store.getState().progress.cards['p/a']?.due).toBe('2026-11-15');
    await Promise.resolve();
    expect((await progressStore.loadEvents()).map((e) => e.id)).toEqual([event.id]);
  });

  it('rebuilds the same state from the stored log on the next start', async () => {
    const progressStore = memoryStore();
    const kv = memoryKv();
    const first = createAppStore({ progressStore, kv });
    await first.getState().init();
    first.getState().recordAnswer({ exerciseId: 'p/x', entryIds: ['p/a', 'p/b'], result: ok, early: false }, new Date(2026, 10, 14, 9));
    await Promise.resolve();

    const second = createAppStore({ progressStore, kv });
    await second.getState().init();
    expect(second.getState().progress).toEqual(first.getState().progress);
  });

  it('persists settings', async () => {
    const kv = memoryKv();
    const store = createAppStore({ progressStore: memoryStore(), kv });
    store.getState().updateSettings({ palette: 'pixel' });
    expect(createAppStore({ progressStore: memoryStore(), kv }).getState().settings.palette).toBe('pixel');
  });

  it('logs sessions and daily goal changes, and exposes the whole log', async () => {
    const progressStore = memoryStore();
    const store = createAppStore({ progressStore, kv: memoryKv() });
    await store.getState().init();
    const now = new Date(2026, 10, 14, 9);

    store.getState().recordAnswer({ exerciseId: 'p/x', entryIds: ['p/a'], result: ok, early: false, sessionId: 's1', comboBefore: 0 }, now);
    store.getState().recordSession({ sessionId: 's1', kind: 'review', startedAt: now.toISOString(), items: 1, correct: 1, mistakes: 0, maxCombo: 1 }, now);
    store.getState().updateSettings({ dailyGoal: 30 }, now);
    store.getState().updateSettings({ dailyGoal: 30, sound: false }, now);

    expect(store.getState().log.map((e) => e.type)).toEqual(['review', 'session', 'setting']);
    expect(store.getState().log[0]).toMatchObject({ sessionId: 's1', comboBefore: 0 });
    expect(store.getState().log[2]).toMatchObject({ key: 'dailyGoal', value: 30, day: '2026-11-14' });
    await Promise.resolve();
    expect(await progressStore.loadEvents()).toHaveLength(3);
  });
});
