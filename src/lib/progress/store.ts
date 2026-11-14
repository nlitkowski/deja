import { openDB, type DBSchema } from 'idb';
import type { ProgressEvent } from './events';

/**
 * Where the event log lives. The app only talks to this interface; syncing (lib/progress/sync.ts) adds an
 * outbox on top of the same storage, so the UI never knows whether an answer has reached the server.
 */
export interface ProgressStore {
  loadEvents(): Promise<ProgressEvent[]>;
  /** Idempotent: an event whose id is already stored is ignored. New events also go to the outbox. */
  append(events: readonly ProgressEvent[]): Promise<void>;
}

/** Which account the local log was last synced with, and how far it has pulled. */
export interface SyncMeta {
  userId?: string;
  cursor: number;
}

/** A ProgressStore that also remembers what has not been sent yet. */
export interface LocalStore extends ProgressStore {
  /** Events from elsewhere (pulled from the server): stored, but not queued for sending. */
  receive(events: readonly ProgressEvent[]): Promise<void>;
  outbox(limit: number): Promise<ProgressEvent[]>;
  outboxSize(): Promise<number>;
  markSent(ids: readonly string[]): Promise<void>;
  /** Queues every stored event, e.g. the first time this log syncs with an account. */
  queueAll(): Promise<void>;
  meta(): Promise<SyncMeta>;
  setMeta(meta: SyncMeta): Promise<void>;
  /** Drops the log, the outbox and the sync position (signing out). */
  clear(): Promise<void>;
}

interface DejaDb extends DBSchema {
  events: { key: string; value: ProgressEvent; indexes: { at: string } };
  outbox: { key: string; value: ProgressEvent };
  meta: { key: string; value: SyncMeta };
}

const META_KEY = 'sync';

export function indexedDbStore(name = 'deja'): LocalStore {
  // Opened on first use, so creating the store has no side effects (e.g. at import time in tests).
  let db: ReturnType<typeof openDB<DejaDb>> | undefined;
  const open = () =>
    (db ??= openDB<DejaDb>(name, 2, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) database.createObjectStore('events', { keyPath: 'id' }).createIndex('at', 'at');
        if (oldVersion < 2) {
          database.createObjectStore('outbox', { keyPath: 'id' });
          database.createObjectStore('meta');
        }
      },
    }));

  async function put(events: readonly ProgressEvent[], queue: boolean) {
    const tx = (await open()).transaction(['events', 'outbox'], 'readwrite');
    // An event already in the log is neither rewritten nor queued again. Only IndexedDB requests are
    // awaited inside, so the transaction stays open.
    const write = async (e: ProgressEvent) => {
      if ((await tx.objectStore('events').getKey(e.id)) !== undefined) return;
      await tx.objectStore('events').put(e);
      if (queue) await tx.objectStore('outbox').put(e);
    };
    await Promise.all([...events.map(write), tx.done]);
  }

  return {
    async loadEvents() {
      return (await open()).getAllFromIndex('events', 'at');
    },
    append: (events) => put(events, true),
    receive: (events) => put(events, false),
    async outbox(limit) {
      return (await open()).getAll('outbox', undefined, limit);
    },
    async outboxSize() {
      return (await open()).count('outbox');
    },
    async markSent(ids) {
      const tx = (await open()).transaction('outbox', 'readwrite');
      await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
    },
    async queueAll() {
      const database = await open();
      const all = await database.getAll('events');
      const tx = database.transaction('outbox', 'readwrite');
      await Promise.all([...all.map((e) => tx.store.put(e)), tx.done]);
    },
    async meta() {
      return (await (await open()).get('meta', META_KEY)) ?? { cursor: 0 };
    },
    async setMeta(meta) {
      await (await open()).put('meta', meta, META_KEY);
    },
    async clear() {
      const tx = (await open()).transaction(['events', 'outbox', 'meta'], 'readwrite');
      await Promise.all([tx.objectStore('events').clear(), tx.objectStore('outbox').clear(), tx.objectStore('meta').clear(), tx.done]);
    },
  };
}

export function memoryStore(initial: readonly ProgressEvent[] = []): LocalStore {
  const events = new Map(initial.map((e) => [e.id, e]));
  const outbox = new Map<string, ProgressEvent>();
  let meta: SyncMeta = { cursor: 0 };
  const put = (added: readonly ProgressEvent[], queue: boolean) => {
    for (const e of added) {
      if (events.has(e.id)) continue;
      events.set(e.id, e);
      if (queue) outbox.set(e.id, e);
    }
  };
  return {
    async loadEvents() {
      return [...events.values()];
    },
    async append(added) {
      put(added, true);
    },
    async receive(added) {
      put(added, false);
    },
    async outbox(limit) {
      return [...outbox.values()].slice(0, limit);
    },
    async outboxSize() {
      return outbox.size;
    },
    async markSent(ids) {
      for (const id of ids) outbox.delete(id);
    },
    async queueAll() {
      for (const e of events.values()) outbox.set(e.id, e);
    },
    async meta() {
      return { ...meta };
    },
    async setMeta(next) {
      meta = { ...next };
    },
    async clear() {
      events.clear();
      outbox.clear();
      meta = { cursor: 0 };
    },
  };
}
