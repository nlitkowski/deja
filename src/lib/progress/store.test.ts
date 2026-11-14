import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { ReviewEvent } from './events';
import { indexedDbStore } from './store';

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
