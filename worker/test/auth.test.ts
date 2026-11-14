import { describe, expect, it } from 'vitest';
import { pkceChallenge } from '../src/crypto';
import { APP, CLIENT_ID, cookieHeader, cookiesOf, ORIGIN, signIdToken, testApp } from './harness';

type T = ReturnType<typeof testApp>;

/** Runs the redirect to Google and back. `claims` go into the ID token Google's token endpoint returns. */
async function signIn(t: T, claims: Record<string, unknown> = {}, tamper: { state?: string; returnTo?: string } = {}) {
  const start = await t.request(`/auth/google?return=${encodeURIComponent(tamper.returnTo ?? `${APP}/`)}`);
  const authorize = new URL(start.headers.get('location')!);
  const oauth = cookiesOf(start);
  const nonce = authorize.searchParams.get('nonce');
  let tokenRequest: URLSearchParams | undefined;
  t.state.tokenResponse = async (body) => {
    tokenRequest = body;
    return Response.json({ id_token: await signIdToken({ sub: 'google-1', email: 'Anna@Example.com', nonce, ...claims }) });
  };
  const state = tamper.state ?? authorize.searchParams.get('state');
  const callback = await t.request(`/auth/google/callback?code=abc&state=${state}`, { headers: { cookie: cookieHeader(oauth) } });
  return { start, authorize, callback, session: cookiesOf(callback), tokenRequest };
}

const me = (t: T, session: Record<string, string>) => t.request('/me', { headers: { cookie: cookieHeader(session) } });
const count = (t: T, table: string) => t.env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<number>('n');

describe('Google sign-in', () => {
  it('sends the browser to Google asking only for openid and email, with PKCE', async () => {
    const { start, authorize } = await signIn(testApp());
    expect(start.status).toBe(302);
    expect(authorize.origin + authorize.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(authorize.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(authorize.searchParams.get('scope')).toBe('openid email');
    expect(authorize.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/auth/google/callback`);
    expect(authorize.searchParams.get('code_challenge_method')).toBe('S256');
    expect(start.headers.getSetCookie()[0]).toMatch(/HttpOnly.*Secure.*SameSite=Lax/i);
  });

  it('creates the user with only the email, starts a session and answers /me', async () => {
    const t = testApp();
    const { authorize, callback, session, tokenRequest } = await signIn(t);
    expect(callback.headers.get('location')).toBe(`${APP}/?account=connected`);
    expect(await pkceChallenge(tokenRequest!.get('code_verifier')!)).toBe(authorize.searchParams.get('code_challenge'));
    expect(callback.headers.getSetCookie().find((c) => c.startsWith('deja_session='))).toMatch(/Path=\/;.*HttpOnly.*Secure.*SameSite=Strict/i);

    const res = await me(t, session);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: 'anna@example.com' });
    expect(await t.env.DB.prepare('SELECT * FROM users').all().then((r) => Object.keys(r.results[0]!))).toEqual(['id', 'email', 'created_at']);
  });

  it('stores only a hash of the session token', async () => {
    const t = testApp();
    const { session } = await signIn(t);
    const stored = await t.env.DB.prepare('SELECT token_hash FROM sessions').first<string>('token_hash');
    expect(stored).not.toBe(session.deja_session);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });

  it('signs the same Google account into the same user and follows an email change', async () => {
    const t = testApp();
    await signIn(t);
    const { session } = await signIn(t, { email: 'anna.new@example.com' });
    expect(await count(t, 'users')).toBe(1);
    expect(await (await me(t, session)).json()).toEqual({ email: 'anna.new@example.com' });
  });

  it('refuses a wrong state, a wrong nonce, another audience or an unverified email', async () => {
    for (const [claims, tamper] of [
      [{}, { state: 'forged' }],
      [{ nonce: 'other' }, {}],
      [{ aud: 'someone-else' }, {}],
      [{ email_verified: false }, {}],
    ] as const) {
      const t = testApp();
      const { callback, session } = await signIn(t, claims, tamper);
      expect(callback.headers.get('location')).toBe(`${APP}/?account=error`);
      expect(session.deja_session).toBeUndefined();
      expect(await count(t, 'users')).toBe(0);
    }
  });

  it('returns to the app page that started sign-in, but only on an allowed origin', async () => {
    const local = await signIn(testApp(), {}, { returnTo: 'http://localhost:5173/' });
    expect(local.callback.headers.get('location')).toBe('http://localhost:5173/?account=connected');
    const evil = await signIn(testApp(), {}, { returnTo: 'https://evil.example/steal' });
    expect(evil.callback.headers.get('location')).toBe(`${APP}/?account=connected`);
  });

  it('comes back as cancelled when the user declines on Google', async () => {
    const t = testApp();
    const start = await t.request('/auth/google');
    const res = await t.request('/auth/google/callback?error=access_denied', { headers: { cookie: cookieHeader(cookiesOf(start)) } });
    expect(res.headers.get('location')).toBe(`${APP}/?account=cancelled`);
  });
});

describe('sessions', () => {
  it('answers /me with 401 without a session', async () => {
    expect((await testApp().request('/me')).status).toBe(401);
  });

  it('ends the session on logout', async () => {
    const t = testApp();
    const { session } = await signIn(t);
    const res = await t.request('/auth/logout', { method: 'POST', headers: { cookie: cookieHeader(session), origin: APP } });
    expect(res.status).toBe(204);
    expect(res.headers.getSetCookie()[0]).toMatch(/^deja_session=;/);
    expect((await me(t, session)).status).toBe(401);
    expect(await count(t, 'sessions')).toBe(0);
  });

  it('expires after 180 days', async () => {
    const t = testApp();
    const { session } = await signIn(t);
    t.state.now = new Date(t.state.now.getTime() + 181 * 86_400_000);
    expect((await me(t, session)).status).toBe(401);
  });

  it('refuses state-changing requests from another origin', async () => {
    const t = testApp();
    const { session } = await signIn(t);
    const res = await t.request('/auth/logout', { method: 'POST', headers: { cookie: cookieHeader(session), origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
    expect((await me(t, session)).status).toBe(200);
  });
});

describe('CORS', () => {
  it('answers the preflight of an allowed origin, with credentials', async () => {
    const res = await testApp().request('/me', {
      method: 'OPTIONS',
      headers: { origin: APP, 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(APP);
    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
    expect(res.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization');
  });

  it('gives no CORS headers to other origins', async () => {
    const res = await testApp().request('/me', { headers: { origin: 'https://evil.example' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
