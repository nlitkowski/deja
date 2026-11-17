import { browserStore, type KeyValueStore } from '../lib/storage';

const KEY = 'deja:signin-nudge-dismissed';
/** "Plus tard" hides the nudge for a while, not forever: progress kept only on one device is still at risk. */
export const SNOOZE_DAYS = 7;

export function nudgeSnoozed(now: Date, store: KeyValueStore | undefined = browserStore()): boolean {
  try {
    const at = Number(store?.getItem(KEY));
    return at > 0 && now.getTime() - at < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

export function snoozeNudge(now: Date, store: KeyValueStore | undefined = browserStore()): void {
  try {
    store?.setItem(KEY, String(now.getTime()));
  } catch {
    // Blocked storage: the nudge just comes back on the next start.
  }
}
