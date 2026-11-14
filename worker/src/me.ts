import { Hono } from 'hono';
import { BACKUP_FORMAT } from '../../src/lib/backup';
import { parseStamped, SYNCED_SETTINGS } from '../../src/lib/settingsSync';
import type { AppEnv } from './app';
import { currentUser, endSession } from './sessions';

export const me = new Hono<AppEnv>();

me.get('/', async (c) => {
  const user = await currentUser(c, c.env.DB, c.var.deps.now());
  if (!user) return c.json({ error: 'unauthenticated' }, 401);
  c.header('cache-control', 'no-store');
  return c.json({ id: user.userId, email: user.email });
});

/**
 * Everything stored about the account (GDPR access and portability). Shaped as an app backup, so the file
 * can also be imported in Réglages → Sauvegarde; `account` is extra and ignored by the import.
 */
me.get('/export', async (c) => {
  const db = c.env.DB;
  const now = c.var.deps.now();
  const user = await currentUser(c, db, now);
  if (!user) return c.json({ error: 'unauthenticated' }, 401);
  const [account, events, settingsRow] = await Promise.all([
    db.prepare('SELECT email, created_at AS createdAt FROM users WHERE id = ?').bind(user.userId).first<{ email: string; createdAt: string }>(),
    db.prepare('SELECT payload FROM events WHERE user_id = ? ORDER BY seq').bind(user.userId).all<{ payload: string }>(),
    db.prepare('SELECT data FROM settings WHERE user_id = ?').bind(user.userId).first<string>('data'),
  ]);
  const stamped = parseStamped(settingsRow ? JSON.parse(settingsRow) : {});
  const settings = Object.fromEntries(SYNCED_SETTINGS.flatMap((key) => (stamped[key] ? [[key, stamped[key].value]] : [])));
  c.header('cache-control', 'no-store');
  c.header('content-disposition', `attachment; filename="deja-compte-${now.toISOString().slice(0, 10)}.json"`);
  return c.json({
    format: BACKUP_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    account,
    settings,
    events: events.results.map((r) => JSON.parse(r.payload)),
  });
});

/** Deletes the account: the user row cascades to identities, sessions, events, settings and entitlements. */
me.delete('/', async (c) => {
  const db = c.env.DB;
  const user = await currentUser(c, db, c.var.deps.now());
  if (!user) return c.json({ error: 'unauthenticated' }, 401);
  await endSession(c, db);
  await db.prepare('DELETE FROM users WHERE id = ?').bind(user.userId).run();
  return c.body(null, 204);
});
