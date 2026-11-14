import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { randomToken, sha256Hex } from './crypto';

export const SESSION_COOKIE = 'deja_session';
const SESSION_DAYS = 180;

export interface SessionUser {
  userId: string;
  email: string;
}

const cookieOptions = { path: '/api', httpOnly: true, secure: true, sameSite: 'Strict' } as const;

export async function startSession(c: Context, db: D1Database, userId: string, now: Date) {
  const token = randomToken();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?').bind(userId, now.toISOString()),
    db
      .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256Hex(token), userId, now.toISOString(), expires.toISOString()),
  ]);
  setCookie(c, SESSION_COOKIE, token, { ...cookieOptions, expires });
}

export async function currentUser(c: Context, db: D1Database, now: Date): Promise<SessionUser | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  const row = await db
    .prepare('SELECT s.user_id AS userId, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?')
    .bind(await sha256Hex(token), now.toISOString())
    .first<SessionUser>();
  return row ?? null;
}

export async function endSession(c: Context, db: D1Database) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  deleteCookie(c, SESSION_COOKIE, cookieOptions);
}
