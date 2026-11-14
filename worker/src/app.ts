import { Hono, type Context } from 'hono';
import type { JWTVerifyGetKey } from 'jose';
import { google } from './google';
import { currentUser, endSession } from './sessions';

export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** Set only in local development, where Vite proxies /api and the Worker would otherwise see its own localhost:8787. */
  PUBLIC_ORIGIN?: string;
}

/** What the Worker gets from the outside world; tests swap in local keys, a fake token endpoint and a fixed clock. */
export interface Deps {
  googleKeys: JWTVerifyGetKey;
  fetch: typeof fetch;
  now: () => Date;
}

export type AppEnv = { Bindings: Env; Variables: { deps: Deps } };

/** The origin the browser sees: where Google sends it back to, and what its Origin header must match. */
export const publicOrigin = (c: Context<AppEnv>) => c.env.PUBLIC_ORIGIN || new URL(c.req.url).origin;

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>().basePath('/api');

  app.use(async (c, next) => {
    c.set('deps', deps);
    await next();
  });

  // Defence in depth next to SameSite=Strict: state-changing requests must come from our own pages.
  app.use(async (c, next) => {
    const origin = c.req.header('origin');
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && origin && origin !== publicOrigin(c)) {
      return c.json({ error: 'forbidden' }, 403);
    }
    await next();
  });

  app.get('/health', async (c) => {
    try {
      const schema = await c.env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'events'").first();
      if (!schema) return c.json({ ok: false, error: 'schema missing' }, 503);
      return c.json({ ok: true });
    } catch {
      return c.json({ ok: false, error: 'database unavailable' }, 503);
    }
  });

  app.route('/auth/google', google);

  app.post('/auth/logout', async (c) => {
    await endSession(c, c.env.DB);
    return c.body(null, 204);
  });

  app.get('/me', async (c) => {
    const user = await currentUser(c, c.env.DB, deps.now());
    if (!user) return c.json({ error: 'unauthenticated' }, 401);
    c.header('cache-control', 'no-store');
    return c.json({ email: user.email });
  });

  app.notFound((c) => c.json({ error: 'not found' }, 404));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'internal error' }, 500);
  });

  return app;
}
