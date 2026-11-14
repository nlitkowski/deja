import { indexedDbStore, type ProgressStore } from '../lib/progress/store';

/** The device's event log, with the sync outbox. One instance, shared by the app store and sync. */
export const localStore = indexedDbStore();

let afterAppend = () => {};

/** Runs after every answer the app saves; sync uses it to send soon after. */
export function onAppend(listener: () => void) {
  afterAppend = listener;
}

/** What the app store writes to: the local store, plus a nudge to sync. */
export const appendingStore: ProgressStore = {
  loadEvents: () => localStore.loadEvents(),
  async append(events) {
    await localStore.append(events);
    afterAppend();
  },
};
