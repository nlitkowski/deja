import { describe, expect, it } from 'vitest';
import { questStatus } from '../../src/game/quests';
import { streakInfo } from '../../src/game/streak';
import { scoreEvents, totalXp, type XpContext } from '../../src/game/xp';
import { createBackup, parseBackup } from '../../src/lib/backup';
import type { ProgressEvent, QuestEvent, ReviewEvent, SessionEvent } from '../../src/lib/progress/events';
import { foldEvents } from '../../src/lib/progress/fold';
import { Projection } from '../../src/lib/progress/projection';
import { memoryStore } from '../../src/lib/progress/store';
import { httpSyncApi, SyncEngine, type SyncStatus } from '../../src/lib/progress/sync';
import { defaultSettings } from '../../src/lib/storage';
import { APP, signedIn, testApp } from './harness';

type T = ReturnType<typeof testApp>;
const xp: XpContext = { isProduction: () => true };
const questCtx = { ...xp, isTricky: () => false };
const TODAY = '2026-11-14';

/** A device as the app runs it: a local store, the folded log in memory, and a sync engine. */
function device(t: T, cookie: string, name: string) {
  const store = memoryStore();
  const projection = new Projection();
  const statuses: SyncStatus[] = [];
  const api = httpSyncApi('https://api.test', async (url, init) =>
    t.request(new URL(String(url)).pathname, { ...init, headers: { ...(init?.headers as Record<string, string>), cookie, origin: APP } }),
  );
  const engine = new SyncEngine(store, api, { onPulled: (events) => projection.add(events), onStatus: (s) => statuses.push(s) });
  return {
    name,
    store,
    projection,
    engine,
    statuses,
    /** Learning offline: the event goes to the log and the outbox, nothing is sent. */
    async record(events: ProgressEvent[]) {
      projection.add(events);
      await store.append(events);
    },
    /** Everything other screens derive from the log. */
    view() {
      const log = projection.events;
      return {
        cards: foldEvents(log).cards,
        xp: totalXp(log, xp),
        streak: streakInfo(log, TODAY, xp),
        quests: questStatus(log, TODAY, questCtx).map(({ quest, progress, claimed }) => ({ id: quest.id, progress, claimed })),
      };
    },
  };
}

let n = 0;
function answer(deviceId: string, day: string, minute: number, entry: string, correct = true): ReviewEvent {
  const at = `${day}T10:${String(minute).padStart(2, '0')}:00.000Z`;
  return { type: 'review', id: `${deviceId}-${++n}`, deviceId, at, day, exerciseId: 'p/x', entryIds: [entry], grade: correct ? 'good' : 'again', correct, nearMiss: false, hintUsed: false, timeMs: 4000, early: false, sessionId: `${deviceId}-${day}`, comboBefore: 0 };
}
function finish(deviceId: string, day: string, minute: number): SessionEvent {
  const at = `${day}T10:${String(minute).padStart(2, '0')}:00.000Z`;
  return { type: 'session', id: `${deviceId}-s${++n}`, deviceId, at, day, sessionId: `${deviceId}-${day}`, kind: 'review', startedAt: at, items: 3, correct: 3, mistakes: 0, maxCombo: 3 };
}
const claim = (deviceId: string, minute: number): QuestEvent => ({ type: 'quest', id: `${deviceId}-q`, deviceId, at: `${TODAY}T11:${minute}0:00.000Z`, day: TODAY, questId: 'daily/x', period: TODAY, xp: 20 });

/** Phone and laptop learn offline on the same days, interleaved minute by minute, and both claim one quest. */
async function interleaved(phone: ReturnType<typeof device>, laptop: ReturnType<typeof device>) {
  for (const day of ['2026-11-12', '2026-11-13', TODAY]) {
    await phone.record([answer('phone', day, 1, 'p/a'), answer('phone', day, 3, 'p/b', day !== TODAY), answer('phone', day, 5, 'p/c'), finish('phone', day, 6)]);
    await laptop.record([answer('laptop', day, 2, 'p/a'), answer('laptop', day, 4, 'p/b'), answer('laptop', day, 7, 'p/d'), finish('laptop', day, 8)]);
  }
  await phone.record([claim('phone', 1)]);
  await laptop.record([claim('laptop', 2)]);
}

describe('sync between devices', () => {
  it('gives two devices that learned offline the same SRS, XP, streak and quests', async () => {
    const t = testApp();
    const cookie = await signedIn(t.env, 'u1');
    const phone = device(t, cookie, 'phone');
    const laptop = device(t, cookie, 'laptop');
    await interleaved(phone, laptop);
    expect(phone.view()).not.toEqual(laptop.view());

    expect(await phone.engine.start('u1')).toBe(true);
    expect(await laptop.engine.start('u1')).toBe(true);
    expect(await phone.engine.sync()).toBe(true); // picks up the laptop's events

    const union = await phone.store.loadEvents();
    expect(phone.view()).toEqual(laptop.view());
    expect(phone.view().cards).toEqual(foldEvents(union).cards);
    // The quest claimed on both devices pays once.
    expect(scoreEvents(phone.projection.events, xp).filter((s) => s.event.type === 'quest').map((s) => s.xp).sort()).toEqual([0, 20]);
    expect(phone.statuses.at(-1)).toBe('synced');
  });

  it('pushes idempotently: syncing again or re-sending everything stores nothing new', async () => {
    const t = testApp();
    const cookie = await signedIn(t.env, 'u1');
    const phone = device(t, cookie, 'phone');
    await interleaved(phone, device(t, cookie, 'unused'));
    await phone.engine.start('u1');
    const rows = () => t.env.DB.prepare('SELECT COUNT(*) AS n FROM events').first<number>('n');
    const before = await rows();
    await phone.store.queueAll();
    await phone.engine.sync();
    await phone.engine.sync();
    expect(await rows()).toBe(before);
  });

  it('rebuilds on a new device, from nothing, the same progress as an export of the old one', async () => {
    const t = testApp();
    const cookie = await signedIn(t.env, 'u1');
    const phone = device(t, cookie, 'phone');
    const laptop = device(t, cookie, 'laptop');
    await interleaved(phone, laptop);
    await phone.engine.start('u1');
    await laptop.engine.start('u1');
    await phone.engine.sync();

    const fresh = device(t, cookie, 'new');
    await fresh.engine.start('u1');
    expect(fresh.view()).toEqual(phone.view());

    const backup = parseBackup(JSON.stringify(createBackup(phone.projection.events, defaultSettings(), new Date())));
    if (!backup.ok) throw new Error('backup did not parse');
    const restored = new Projection(backup.events);
    expect(foldEvents(fresh.projection.events)).toEqual(foldEvents(restored.events));
    expect(totalXp(fresh.projection.events, xp)).toBe(totalXp(restored.events, xp));
  });

  it('keeps learning offline: a failed sync leaves everything queued for the next try', async () => {
    const t = testApp();
    const cookie = await signedIn(t.env, 'u1');
    const phone = device(t, cookie, 'phone');
    await phone.record([answer('phone', TODAY, 1, 'p/a')]);
    const offline = new SyncEngine(
      phone.store,
      httpSyncApi('https://api.test', async () => {
        throw new TypeError('Failed to fetch');
      }),
      { onPulled: () => {}, onStatus: (s) => phone.statuses.push(s) },
    );
    expect(await offline.start('u1')).toBe(false);
    expect(phone.statuses.at(-1)).toBe('offline');
    expect(await phone.store.outboxSize()).toBe(1);

    expect(await phone.engine.start('u1')).toBe(true);
    expect(await phone.store.outboxSize()).toBe(0);
  });
});
