import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { jwtVerify } from 'jose';
import { publicOrigin, type AppEnv } from './app';
import { pkceChallenge, randomToken } from './crypto';
import { startSession } from './sessions';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

const OAUTH_COOKIE = 'deja_oauth';
// Lax, not Strict: the callback is a top-level navigation coming back from Google, a cross-site request.
const oauthCookie = { path: '/api/auth', httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 600 } as const;

interface Pending {
  state: string;
  nonce: string;
  verifier: string;
}

export type SignInResult = 'connected' | 'cancelled' | 'error';
const back = (result: SignInResult) => `/?account=${result}`;

export const google = new Hono<AppEnv>();

/** Authorization code flow with PKCE, run entirely by the Worker: the app never loads Google's scripts. */
google.get('/', async (c) => {
  const pending: Pending = { state: randomToken(), nonce: randomToken(), verifier: randomToken() };
  setCookie(c, OAUTH_COOKIE, JSON.stringify(pending), oauthCookie);
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${publicOrigin(c)}/api/auth/google/callback`,
    response_type: 'code',
    // Only what the account needs: a stable id and the email. No name, no avatar.
    scope: 'openid email',
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: await pkceChallenge(pending.verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return c.redirect(url.toString());
});

google.get('/callback', async (c) => {
  const { deps } = c.var;
  const pending = readPending(getCookie(c, OAUTH_COOKIE));
  deleteCookie(c, OAUTH_COOKIE, oauthCookie);
  const { code, state, error } = c.req.query();
  if (error) return c.redirect(back('cancelled'));
  if (!pending || !code || state !== pending.state) return c.redirect(back('error'));

  const res = await deps.fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${publicOrigin(c)}/api/auth/google/callback`,
      grant_type: 'authorization_code',
      code_verifier: pending.verifier,
    }),
  });
  if (!res.ok) return c.redirect(back('error'));
  const { id_token: idToken } = await res.json<{ id_token?: string }>();
  if (!idToken) return c.redirect(back('error'));

  const now = deps.now();
  let claims;
  try {
    ({ payload: claims } = await jwtVerify(idToken, deps.googleKeys, { issuer: ISSUERS, audience: c.env.GOOGLE_CLIENT_ID, currentDate: now }));
  } catch {
    return c.redirect(back('error'));
  }
  if (claims.nonce !== pending.nonce || claims.email_verified !== true || typeof claims.email !== 'string' || !claims.sub) {
    return c.redirect(back('error'));
  }

  const userId = await upsertUser(c.env.DB, claims.sub, claims.email.toLowerCase(), now);
  await startSession(c, c.env.DB, userId, now);
  return c.redirect(back('connected'));
});

function readPending(raw: string | undefined): Pending | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Pending>;
    return p.state && p.nonce && p.verifier ? (p as Pending) : null;
  } catch {
    return null;
  }
}

/** Finds the user behind this Google account, or creates one. Keeps the stored email current. */
async function upsertUser(db: D1Database, subject: string, email: string, now: Date): Promise<string> {
  const known = await db.prepare("SELECT user_id FROM identities WHERE provider = 'google' AND subject = ?").bind(subject).first<string>('user_id');
  if (known) {
    await db
      .prepare('UPDATE users SET email = ?1 WHERE id = ?2 AND NOT EXISTS (SELECT 1 FROM users WHERE email = ?1 AND id <> ?2)')
      .bind(email, known)
      .run();
    return known;
  }
  const at = now.toISOString();
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<string>('id');
  const userId = existing ?? crypto.randomUUID();
  await db.batch([
    ...(existing ? [] : [db.prepare('INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)').bind(userId, email, at)]),
    db.prepare("INSERT INTO identities (provider, subject, user_id, created_at) VALUES ('google', ?, ?, ?)").bind(subject, userId, at),
  ]);
  return userId;
}
