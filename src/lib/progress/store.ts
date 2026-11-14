import { openDB, type DBSchema } from 'idb';
import type { ProgressEvent } from './events';

/**
 * Where the event log lives. The app only talks to this interface, so a syncing implementation
 * (local IndexedDB + upload/download to a backend) can replace the local one without touching the UI.
 */
export interface ProgressStore {
  loadEvents(): Promise<ProgressEvent[]>;
  /** Idempotent: an event whose id is already stored is ignored. */
  append(events: readonly ProgressEvent[]): Promise<void>;
}

interface DejaDb extends DBSchema {
  events: { key: string; value: ProgressEvent; indexes: { at: string } };
}

export function indexedDbStore(name = 'deja'): ProgressStore {
  // Opened on first use, so creating the store has no side effects (e.g. at import time in tests).
  let db: ReturnType<typeof openDB<DejaDb>> | undefined;
  const open = () =>
    (db ??= openDB<DejaDb>(name, 1, {
      upgrade(database) {
        database.createObjectStore('events', { keyPath: 'id' }).createIndex('at', 'at');
      },
    }));
  return {
    async loadEvents() {
      return (await open()).getAllFromIndex('events', 'at');
    },
    async append(events) {
      const tx = (await open()).transaction('events', 'readwrite');
      await Promise.all([...events.map((e) => tx.store.put(e)), tx.done]);
    },
  };
}

export function memoryStore(initial: readonly ProgressEvent[] = []): ProgressStore {
  const events = new Map(initial.map((e) => [e.id, e]));
  return {
    async loadEvents() {
      return [...events.values()];
    },
    async append(added) {
      for (const e of added) events.set(e.id, e);
    },
  };
}
