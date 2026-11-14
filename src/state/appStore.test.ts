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

  it('imports a backup from another device: merges the logs, restores settings, and adds nothing twice', async () => {
    const answer = { exerciseId: 'p/x', entryIds: ['p/a'], result: ok, early: false };
    const old = createAppStore({ progressStore: memoryStore(), kv: memoryKv() });
    await old.getState().init();
    old.getState().recordAnswer(answer, new Date('2026-11-10T10:00:00Z'));
    old.getState().updateSettings({ palette: 'pixel' });

    const kv = memoryKv();
    const progressStore = memoryStore();
    const fresh = createAppStore({ progressStore, kv });
    await fresh.getState().init();
    fresh.getState().recordAnswer({ ...answer, entryIds: ['p/b'] }, new Date('2026-11-14T10:00:00Z'));

    expect(await fresh.getState().importBackup(old.getState().log, { palette: 'pixel' })).toBe(1);
    expect(Object.keys(fresh.getState().progress.cards).sort()).toEqual(['p/a', 'p/b']);
    expect(await progressStore.loadEvents()).toHaveLength(2);
    expect(fresh.getState().settings.palette).toBe('pixel');
    expect(JSON.parse(kv.raw(STORAGE_KEY)!).settings.palette).toBe('pixel');

    expect(await fresh.getState().importBackup(old.getState().log, {})).toBe(0);
    expect(fresh.getState().log).toHaveLength(2);
  });

  it('rebuilds identical progress on a new address from a backup alone, whatever the event order', async () => {
    const origin = createAppStore({ progressStore: memoryStore(), kv: memoryKv() });
    await origin.getState().init();
    const day = (d: number, h = 10) => new Date(`2026-11-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00Z`);
    origin.getState().updateSettings({ dailyGoal: 30 }, day(1, 8));
    for (let d = 1; d <= 6; d++) {
      for (const [i, entry] of ['p/a', 'p/b', 'p/c'].entries()) {
        const result = { ...ok, correct: (d + i) % 4 !== 0 };
        origin.getState().recordAnswer({ exerciseId: 'p/x', entryIds: [entry], result, early: false }, day(d, 10 + i));
      }
      origin.getState().recordSession({ sessionId: `s${d}`, kind: 'review', startedAt: day(d).toISOString(), items: 3, correct: 2, mistakes: 1, maxCombo: 2 }, day(d, 13));
    }
    origin.getState().claimQuest({ questId: 'daily/x', period: '2026-11-06', xp: 20 }, day(6, 14));

    const shuffled = [...origin.getState().log].reverse();
    const target = createAppStore({ progressStore: memoryStore(), kv: memoryKv() });
    await target.getState().init();
    await target.getState().importBackup(shuffled, origin.getState().settings);

    expect(target.getState().progress).toEqual(origin.getState().progress);
    expect(target.getState().log).toEqual(origin.getState().log);
    expect(target.getState().settings).toEqual(origin.getState().settings);
  });

  it('stamps synced settings when they change and takes only newer ones from the account', async () => {
    const store = createAppStore({ progressStore: memoryStore(), kv: memoryKv() });
    await store.getState().init();
    store.getState().updateSettings({ palette: 'pixel', navCollapsed: true }, new Date('2026-11-14T10:00:00Z'));
    const stamped = store.getState().stampedSettings();
    expect(stamped.palette).toEqual({ value: 'pixel', at: '2026-11-14T10:00:00.000Z' });
    expect(stamped.helpLang?.at).toBe('1970-01-01T00:00:00.000Z');

    store.getState().applyRemoteSettings({
      palette: { value: 'provence', at: '2026-11-14T09:00:00.000Z' },
      helpLang: { value: 'fr', at: '2026-11-13T09:00:00.000Z' },
    });
    expect(store.getState().settings.palette).toBe('pixel');
    expect(store.getState().settings.helpLang).toBe('fr');
    expect(store.getState().settings.navCollapsed).toBe(true);
  });

  it('follows a daily goal changed on another device', async () => {
    const store = createAppStore({ progressStore: memoryStore(), kv: memoryKv() });
    await store.getState().init();
    store.getState().receive([{ type: 'setting', id: 'g', deviceId: 'other', at: '2026-11-14T10:00:00.000Z', day: '2026-11-14', key: 'dailyGoal', value: 100 }]);
    expect(store.getState().settings.dailyGoal).toBe(100);
  });
});

