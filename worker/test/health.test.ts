import { describe, expect, it } from 'vitest';
import { testApp } from './harness';

describe('GET /api/health', () => {
  it('is ok once the schema is migrated', async () => {
    const res = await testApp().request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('reports a missing schema', async () => {
    const t = testApp();
    await t.env.DB.exec('DROP TABLE events');
    expect((await t.request('/api/health')).status).toBe(503);
  });

  it('answers unknown API paths with JSON 404', async () => {
    const res = await testApp().request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not found' });
  });
});

describe('schema', () => {
  it('ignores a re-sent event and deletes everything with the user', async () => {
    const { DB: db } = testApp().env;
    const now = '2026-11-14T10:00:00Z';
    await db.prepare('INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)').bind('u1', 'a@example.com', now).run();
    const insert = () =>
      db
        .prepare(
          'INSERT INTO events (id, user_id, device_id, at, day, type, payload, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, id) DO NOTHING',
        )
        .bind('e1', 'u1', 'd1', now, '2026-11-14', 'review', '{}', now)
        .run();
    await insert();
    await insert();
    expect(await db.prepare('SELECT COUNT(*) AS n FROM events').first('n')).toBe(1);

    await db.prepare('DELETE FROM users WHERE id = ?').bind('u1').run();
    expect(await db.prepare('SELECT COUNT(*) AS n FROM events').first('n')).toBe(0);
  });
});
