import { Hono } from 'hono';
import { parseEvent } from '../../src/lib/progress/schema';
import type { AppEnv } from './app';
import { currentUser } from './sessions';

/** Most events per push, and per pulled page. */
export const SYNC_BATCH = 500;

export const sync = new Hono<AppEnv>();

/**
 * Push and pull in one request: `{ events, cursor }` stores the device's new events (a re-sent id is
 * ignored) and answers with the user's events after `cursor`, a page at a time. Events are checked one
 * by one against the app's own schema, so one bad event never blocks the rest.
 */
sync.post('/', async (c) => {
  const db = c.env.DB;
  const now = c.var.deps.now();
  const user = await currentUser(c, db, now);
  if (!user) return c.json({ error: 'unauthenticated' }, 401);

  let body: { events?: unknown; cursor?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }
  if (!Array.isArray(body.events)) return c.json({ error: 'events must be an array' }, 400);
  if (body.events.length > SYNC_BATCH) return c.json({ error: `at most ${SYNC_BATCH} events per request` }, 413);
  const cursor = typeof body.cursor === 'number' && Number.isInteger(body.cursor) && body.cursor > 0 ? body.cursor : 0;

  const accepted: string[] = [];
  const rejected: { index: number; id?: string }[] = [];
  const inserts: D1PreparedStatement[] = [];
  const insert = db.prepare(
    'INSERT INTO events (id, user_id, device_id, at, day, type, payload, received_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, id) DO NOTHING',
  );
  body.events.forEach((raw, index) => {
    const event = parseEvent(raw);
    if (!event) {
      const id = (raw as { id?: unknown } | null)?.id;
      rejected.push({ index, ...(typeof id === 'string' ? { id } : {}) });
      return;
    }
    inserts.push(insert.bind(event.id, user.userId, event.deviceId, event.at, event.day, event.type, JSON.stringify(event), now.toISOString()));
    accepted.push(event.id);
  });
  if (inserts.length) await db.batch(inserts);

  const { results } = await db
    .prepare('SELECT seq, payload FROM events WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?')
    .bind(user.userId, cursor, SYNC_BATCH + 1)
    .all<{ seq: number; payload: string }>();
  const page = results.slice(0, SYNC_BATCH);
  c.header('cache-control', 'no-store');
  return c.json({
    accepted,
    rejected,
    events: page.map((r) => JSON.parse(r.payload)),
    cursor: page.at(-1)?.seq ?? cursor,
    more: results.length > SYNC_BATCH,
  });
});
