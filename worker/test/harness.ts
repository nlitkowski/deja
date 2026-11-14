import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import { createApp, type Env } from '../src/app';
import { TOKEN_URL } from '../src/google';
import { testDb } from './d1';

export const CLIENT_ID = 'test-client.apps.googleusercontent.com';
export const ORIGIN = 'https://deja-api.test';
export const APP = 'https://deja.test';

const { privateKey, publicKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };

export function signIdToken(claims: JWTPayload) {
  return new SignJWT({ iss: 'https://accounts.google.com', aud: CLIENT_ID, email_verified: true, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);
}

/** A Worker on an in-memory database, with Google's token endpoint answered by `tokenResponse`. */
export function testApp() {
  const env: Env = { DB: testDb(), GOOGLE_CLIENT_ID: CLIENT_ID, GOOGLE_CLIENT_SECRET: 'secret', ALLOWED_ORIGINS: `${APP}, http://localhost:5173` };
  const state = { now: new Date(), tokenResponse: async (body: URLSearchParams): Promise<Response> => new Response(`no token for ${body.get('code')}`, { status: 500 }) };
  const app = createApp({
    googleKeys: createLocalJWKSet({ keys: [jwk] }),
    now: () => state.now,
    fetch: async (input, init) => {
      if (String(input) !== TOKEN_URL) throw new Error(`unexpected fetch ${String(input)}`);
      return state.tokenResponse(new URLSearchParams(String(init?.body)));
    },
  });
  const request = (path: string, init: RequestInit = {}) => app.request(`${ORIGIN}${path}`, init, env);
  return { app, env, state, request };
}

/** `name=value` pairs from Set-Cookie headers, ready for a Cookie header; cleared cookies are left out. */
export function cookiesOf(res: Response): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of res.headers.getSetCookie()) {
    const [pair = ''] = line.split(';');
    const [name = '', value = ''] = pair.split('=');
    if (value) out[name] = value;
  }
  return out;
}

export const cookieHeader = (cookies: Record<string, string>) =>
  Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
