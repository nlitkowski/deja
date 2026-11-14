import type { ProgressEvent } from './events';
import { parseEvent } from './schema';
import type { StampedSettings } from '../settingsSync';
import type { LocalStore } from './store';

/** Most events per request; the API refuses more. */
export const SYNC_BATCH = 500;

/** `off`: not signed in. `pending`: something waits to be sent and will be retried. */
export type SyncStatus = 'off' | 'syncing' | 'synced' | 'pending' | 'offline';

export interface SyncResponse {
  accepted: string[];
  rejected: { index: number; id?: string }[];
  events: unknown[];
  cursor: number;
  more: boolean;
  settings?: unknown;
}

export interface SyncApi {
  sync(request: { events: ProgressEvent[]; cursor: number; settings?: StampedSettings }): Promise<SyncResponse>;
}

/** The session ended on the server (expired, signed out elsewhere). */
export class SyncAuthError extends Error {}
/** No network: worth retrying as soon as the device is back online. */
export class SyncOfflineError extends Error {}

export function httpSyncApi(apiUrl: string, fetcher: typeof fetch = fetch): SyncApi {
  return {
    async sync(request) {
      let res: Response;
      try {
        // Asserted, not annotated: the Worker's fetch types (this file is shared with its tests) lack `credentials`.
        const init = { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request) } as RequestInit;
        res = await fetcher(`${apiUrl}/sync`, init);
      } catch (error) {
        throw new SyncOfflineError(String(error));
      }
      if (res.status === 401) throw new SyncAuthError('session ended');
      if (!res.ok) throw new Error(`sync failed: ${res.status}`);
      return (await res.json()) as SyncResponse;
    },
  };
}

export interface SyncCallbacks {
  /** New events from the server, already stored locally. */
  onPulled: (events: ProgressEvent[]) => void;
  onStatus: (status: SyncStatus, pending: number) => void;
  onSignedOut?: () => void;
  /** The device's synced settings, and what to do with the account's merged ones (untrusted input). */
  settings?: { get: () => StampedSettings; apply: (merged: unknown) => void };
}

/**
 * Pushes the outbox and pulls everything after the cursor, until neither has more. Runs one sync at a
 * time; asking during a run schedules one more run after it. Failures only change the status: learning
 * goes on locally and the next trigger (an answer, coming back online or to the app) retries.
 */
export class SyncEngine {
  private userId: string | undefined;
  private running: Promise<boolean> | undefined;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly store: LocalStore,
    private readonly api: SyncApi,
    private readonly callbacks: SyncCallbacks,
  ) {}

  get signedIn() {
    return this.userId !== undefined;
  }

  /** Signed in as `userId`. A log that never synced with this account is sent whole, and pulled from the start. */
  async start(userId: string): Promise<boolean> {
    const meta = await this.store.meta();
    if (meta.userId !== userId) {
      await this.store.queueAll();
      await this.store.setMeta({ userId, cursor: 0 });
    }
    this.userId = userId;
    return this.sync();
  }

  stop() {
    this.userId = undefined;
    clearTimeout(this.timer);
    this.callbacks.onStatus('off', 0);
  }

  /** Syncs now; resolves true when nothing is left to send. */
  sync(): Promise<boolean> {
    clearTimeout(this.timer);
    if (!this.userId) return Promise.resolve(false);
    if (this.running) {
      this.again = true;
      return this.running;
    }
    const run = this.run().finally(() => {
      this.running = undefined;
      if (this.again) {
        this.again = false;
        void this.sync();
      }
    });
    this.running = run;
    return run;
  }

  /** Syncs after a short pause, so a burst of answers goes out in one request. */
  syncSoon(delayMs = 2000) {
    if (!this.userId) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.sync(), delayMs);
  }

  private async run(): Promise<boolean> {
    const userId = this.userId!;
    this.callbacks.onStatus('syncing', await this.store.outboxSize());
    try {
      let { cursor } = await this.store.meta();
      for (let round = 0; ; round++) {
        const outgoing = await this.store.outbox(SYNC_BATCH);
        // Settings are small; they ride along with the first request of a run.
        const settings = round === 0 ? this.callbacks.settings?.get() : undefined;
        const res = await this.api.sync({ events: outgoing, cursor, ...(settings ? { settings } : {}) });
        if (res.settings) this.callbacks.settings?.apply(res.settings);
        // Rejected events stay in the local log but leave the outbox, so one bad event cannot block the rest.
        const rejected = res.rejected.flatMap((r) => outgoing[r.index]?.id ?? []);
        if (rejected.length) console.warn('Déjà: events refused by the server', rejected);
        await this.store.markSent([...res.accepted, ...rejected]);

        const pulled = res.events.flatMap((e) => parseEvent(e) ?? []);
        if (pulled.length) {
          await this.store.receive(pulled);
          this.callbacks.onPulled(pulled);
        }
        cursor = res.cursor;
        await this.store.setMeta({ userId, cursor });
        if (!res.more && outgoing.length < SYNC_BATCH) break;
      }
      const pending = await this.store.outboxSize();
      this.callbacks.onStatus(pending ? 'pending' : 'synced', pending);
      return pending === 0;
    } catch (error) {
      const pending = await this.store.outboxSize();
      if (error instanceof SyncAuthError) {
        this.stop();
        this.callbacks.onSignedOut?.();
      } else {
        this.callbacks.onStatus(error instanceof SyncOfflineError ? 'offline' : 'pending', pending);
        // A server hiccup is retried on its own; offline waits for the `online` event.
        if (!(error instanceof SyncOfflineError)) this.syncSoon(30_000);
      }
      return false;
    }
  }
}
