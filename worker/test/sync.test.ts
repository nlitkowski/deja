import { describe, expect, it } from 'vitest';
import type { ReviewEvent } from '../../src/lib/progress/events';
import { SYNC_BATCH } from '../src/sync';
import { APP, signedIn, testApp } from './harness';

const review = (id: string, overrides: Partial<ReviewEvent> = {}): ReviewEvent => ({
  type: 'review',
  id,
  deviceId: 'phone',
  at: '2026-11-14T10:00:00.000Z',
  day: '2026-11-14',
  exerciseId: 'p/x',
  entryIds: ['p/a'],
  grade: 'good',
  correct: true,
  nearMiss: false,
  hintUsed: false,
  timeMs: 4000,
  early: false,
  ...overrides,
});

type T = ReturnType<typeof testApp>;
const post = (t: T, cookie: string, body: unknown) =>
  t.request('/sync', { method: 'POST', headers: { cookie, origin: APP, 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /sync', () => {
  it('needs a session', async () => {
    const t = testApp();
    expect((await t.request('/sync', { method: 'POST', body: '{"events":[]}' })).status).toBe(401);
  });

  it('stores events and returns them from the cursor; re-sending is a no-op', async () => {
    const t = testApp();
    const cookie = await signedIn(t.env, 'u1');
    const first = await (await post(t, cookie, { events: [review('a'), review('b')], cursor: 0 })).json<{ accepted: string[]; events: ReviewEvent[]; cursor: number; more: boolean }>();
    expect(first.accepted).toEqual(['a', 'b']);
    expect(first.events.map((e) => e.id)).toEqual(['a', 'b']);
    expect(first.events[0]).toEqual(review('a'));
    expect(first.more).toBe(false);

    const again = await (await post(t, cookie, { events: [review('a')], cursor: first.cursor })).json<{ events: ReviewEvent[]; cursor: number }>();
    expect(again.events).toEqual([]);
    expect(again.cursor).toBe(first.cursor);
    expect(await t.env.DB.prepare('SELECT COUNT(*) AS n FROM events').first('n')).toBe(2);
  });

  it('rejects bad events one by one and keeps the good ones', async () => {
    const t = testApp();
    const cookie = await signedIn(t.env, 'u1');
    const res = await (await post(t, cookie, { events: [review('ok'), { ...review('bad'), grade: 'great' }, { type: 'future-thing', id: 'x' }, 42], cursor: 0 })).json<{ accepted: string[]; rejected: unknown[] }>();
    expect(res.accepted).toEqual(['ok']);
    expect(res.rejected).toEqual([{ index: 1, id: 'bad' }, { index: 2, id: 'x' }, { index: 3 }]);
  });

  it('keeps each user to their own events', async () => {
    const t = testApp();
    const anna = await signedIn(t.env, 'anna');
    const ben = await signedIn(t.env, 'ben');
    await post(t, anna, { events: [review('a')], cursor: 0 });
    // The same event id from another user is a different row, not a collision.
    await post(t, ben, { events: [review('a', { deviceId: 'ben-phone' })], cursor: 0 });
    const pulled = await (await post(t, ben, { events: [], cursor: 0 })).json<{ events: ReviewEvent[] }>();
    expect(pulled.events.map((e) => e.deviceId)).toEqual(['ben-phone']);
  });

  it('pages a long history and refuses oversized pushes', async () => {
    const t = testApp();
    const cookie = await signedIn(t.env, 'u1');
    const many = Array.from({ length: SYNC_BATCH }, (_, i) => review(`e${i}`));
    await post(t, cookie, { events: many, cursor: 0 });
    await post(t, cookie, { events: [review('last')], cursor: 0 });

    const page1 = await (await post(t, cookie, { events: [], cursor: 0 })).json<{ events: ReviewEvent[]; cursor: number; more: boolean }>();
    expect(page1.events).toHaveLength(SYNC_BATCH);
    expect(page1.more).toBe(true);
    const page2 = await (await post(t, cookie, { events: [], cursor: page1.cursor })).json<{ events: ReviewEvent[]; more: boolean }>();
    expect(page2.events.map((e) => e.id)).toEqual(['last']);
    expect(page2.more).toBe(false);

    expect((await post(t, cookie, { events: [...many, review('one-too-many')], cursor: 0 })).status).toBe(413);
  });

  it('merges settings from two devices, the later change per field winning', async () => {
    const t = testApp();
    const cookie = await signedIn(t.env, 'u1');
    await post(t, cookie, { events: [], cursor: 0, settings: { palette: { value: 'pixel', at: '2026-11-14T11:00:00.000Z' }, helpLang: { value: 'pl', at: '2026-11-14T09:00:00.000Z' } } });
    const res = await (
      await post(t, cookie, { events: [], cursor: 0, settings: { palette: { value: 'provence', at: '2026-11-14T10:00:00.000Z' }, helpLang: { value: 'fr', at: '2026-11-14T10:00:00.000Z' }, sound: { value: 'loud', at: '2026-11-14T10:00:00.000Z' } } })
    ).json<{ settings: Record<string, { value: unknown }> }>();
    expect(res.settings).toEqual({ palette: { value: 'pixel', at: '2026-11-14T11:00:00.000Z' }, helpLang: { value: 'fr', at: '2026-11-14T10:00:00.000Z' } });
  });
});

