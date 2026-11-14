import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import type { JWTVerifyGetKey } from 'jose';
import { google } from './google';
import { currentUser, endSession } from './sessions';
import { sync } from './sync';

export interface Env {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** Comma-separated origins of the app that may call the API with the session cookie; the first is the default. */
  ALLOWED_ORIGINS: string;
}

/** What the Worker gets from the outside world; tests swap in local keys, a fake token endpoint and a fixed clock. */
export interface Deps {
  googleKeys: JWTVerifyGetKey;
  fetch: typeof fetch;
  now: () => Date;
}

export type AppEnv = { Bindings: Env; Variables: { deps: Deps } };

export const allowedOrigins = (c: Context<AppEnv>) =>
  c.env.ALLOWED_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.use(async (c, next) => {
    c.set('deps', deps);
    await next();
  });

  // The app lives on another subdomain; credentials are allowed so the session cookie travels with fetch.
  app.use(
    cors({
      origin: (origin, c: Context<AppEnv>) => (allowedOrigins(c).includes(origin) ? origin : null),
      credentials: true,
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Authorization', 'Content-Type'],
      maxAge: 86400,
    }),
  );

  // Defence in depth next to SameSite=Strict: state-changing requests must come from the app.
  app.use(async (c, next) => {
    const origin = c.req.header('origin');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && origin && !allowedOrigins(c).includes(origin)) {
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
    return c.json({ id: user.userId, email: user.email });
  });

  app.route('/sync', sync);

  app.notFound((c) => c.json({ error: 'not found' }, 404));

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'internal error' }, 500);
  });

  return app;
}
