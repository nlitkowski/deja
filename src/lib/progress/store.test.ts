import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { ReviewEvent } from './events';
import { openDB } from 'idb';
import { indexedDbStore, memoryStore } from './store';

const event = (id: string, at: string): ReviewEvent => ({
  type: 'review',
  id,
  deviceId: 'd1',
  at,
  day: at.slice(0, 10),
  exerciseId: 'p/x',
  entryIds: ['p/a'],
  grade: 'good',
  correct: true,
  nearMiss: false,
  hintUsed: false,
  timeMs: 3000,
  early: false,
});

describe('indexedDbStore', () => {
  it('persists events across instances, in time order', async () => {
    const first = indexedDbStore('test-persist');
    await first.append([event('b', '2026-11-14T09:00:00Z'), event('a', '2026-11-14T08:00:00Z')]);
    const reopened = indexedDbStore('test-persist');
    expect((await reopened.loadEvents()).map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('ignores events it already has (safe to re-send during sync)', async () => {
    const store = indexedDbStore('test-idempotent');
    const e = event('a', '2026-11-14T08:00:00Z');
    await store.append([e]);
    await store.append([e]);
    expect(await store.loadEvents()).toHaveLength(1);
  });
});

describe.each([
  ['indexedDbStore', (n: string) => indexedDbStore(`test-outbox-${n}`)],
  ['memoryStore', () => memoryStore()],
])('%s outbox', (_, make) => {
  it('queues new answers, not pulled ones, and forgets what was sent', async () => {
    const store = make('queue');
    await store.append([event('mine', '2026-11-14T08:00:00Z')]);
    await store.receive([event('theirs', '2026-11-14T09:00:00Z')]);
    await store.append([event('mine', '2026-11-14T08:00:00Z')]);
    expect((await store.outbox(10)).map((e) => e.id)).toEqual(['mine']);
    expect((await store.loadEvents()).map((e) => e.id)).toEqual(['mine', 'theirs']);
    await store.markSent(['mine']);
    expect(await store.outboxSize()).toBe(0);
  });

  it('queues the whole log for a first sync, keeps the cursor and clears everything on sign-out', async () => {
    const store = make('all');
    await store.receive([event('a', '2026-11-14T08:00:00Z'), event('b', '2026-11-14T09:00:00Z')]);
    await store.queueAll();
    expect(await store.outboxSize()).toBe(2);
    expect(await store.meta()).toEqual({ cursor: 0 });
    await store.setMeta({ userId: 'u1', cursor: 7 });
    expect(await store.meta()).toEqual({ userId: 'u1', cursor: 7 });
    await store.clear();
    expect(await store.loadEvents()).toEqual([]);
    expect(await store.outboxSize()).toBe(0);
    expect(await store.meta()).toEqual({ cursor: 0 });
  });
});

describe('indexedDbStore upgrade', () => {
  it('keeps the log of a version 1 database', async () => {
    const v1 = await openDB('test-upgrade', 1, {
      upgrade(db) {
        db.createObjectStore('events', { keyPath: 'id' }).createIndex('at', 'at');
      },
    });
    await v1.put('events', event('old', '2026-11-01T08:00:00Z'));
    v1.close();
    const store = indexedDbStore('test-upgrade');
    expect((await store.loadEvents()).map((e) => e.id)).toEqual(['old']);
    expect(await store.outboxSize()).toBe(0);
  });
});
