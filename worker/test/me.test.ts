import { describe, expect, it } from 'vitest';
import { parseBackup } from '../../src/lib/backup';
import type { ReviewEvent } from '../../src/lib/progress/events';
import { APP, signedIn, testApp } from './harness';

const review = (id: string): ReviewEvent => ({ type: 'review', id, deviceId: 'phone', at: '2026-11-14T10:00:00.000Z', day: '2026-11-14', exerciseId: 'p/x', entryIds: ['p/a'], grade: 'good', correct: true, nearMiss: false, hintUsed: false, timeMs: 4000, early: false });

type T = ReturnType<typeof testApp>;
const call = (t: T, cookie: string, path: string, method = 'GET', body?: unknown) =>
  t.request(path, { method, headers: { cookie, origin: APP, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });

async function withData(t: T, user: string) {
  const cookie = await signedIn(t.env, user, `${user}@example.com`);
  await call(t, cookie, '/sync', 'POST', { events: [review(`${user}-1`), review(`${user}-2`)], cursor: 0, settings: { palette: { value: 'pixel', at: '2026-11-14T10:00:00.000Z' } } });
  return cookie;
}

describe('GET /me/export', () => {
  it('downloads the account, its settings and its whole log, importable as a backup', async () => {
    const t = testApp();
    const cookie = await withData(t, 'anna');
    const res = await call(t, cookie, '/me/export');
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="deja-compte-\d{4}-\d{2}-\d{2}\.json"/);
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.account).toEqual({ email: 'anna@example.com', createdAt: '2026-01-01T00:00:00Z' });
    expect(body.settings).toEqual({ palette: 'pixel' });
    const asBackup = parseBackup(text);
    expect(asBackup.ok && asBackup.events.map((e) => e.id)).toEqual(['anna-1', 'anna-2']);
  });

  it('needs a session', async () => {
    expect((await testApp().request('/me/export')).status).toBe(401);
  });
});

describe('DELETE /me', () => {
  it('removes the user and everything stored for them, and nobody else', async () => {
    const t = testApp();
    const anna = await withData(t, 'anna');
    await withData(t, 'ben');
    const res = await call(t, anna, '/me', 'DELETE');
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()[0]).toMatch(/^deja_session=;/);
    for (const table of ['users', 'identities', 'sessions', 'events', 'settings', 'entitlements']) {
      const column = table === 'users' ? 'id' : 'user_id';
      expect(await t.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = 'anna'`).first('n')).toBe(0);
    }
    expect(await t.env.DB.prepare("SELECT COUNT(*) AS n FROM events WHERE user_id = 'ben'").first('n')).toBe(2);
    expect((await call(t, anna, '/me')).status).toBe(401);
  });

  it('refuses another site', async () => {
    const t = testApp();
    const anna = await withData(t, 'anna');
    const res = await t.request('/me', { method: 'DELETE', headers: { cookie: anna, origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
  });
});
