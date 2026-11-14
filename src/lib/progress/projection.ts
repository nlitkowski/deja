import type { ProgressEvent } from './events';
import { applyEvents, compareEvents, emptyProgress, foldEvents, type ProgressState } from './fold';

/**
 * The log in memory plus its folded state. Events newer than everything seen are applied on top
 * of the last state; an older one (e.g. synced from another device) triggers a full refold.
 */
export class Projection {
  /** Replaced (not mutated) on every change, in arrival order. */
  events: readonly ProgressEvent[] = [];
  private readonly ids = new Set<string>();
  private newest: ProgressEvent | undefined;
  state: ProgressState = emptyProgress();

  constructor(events: readonly ProgressEvent[] = []) {
    this.add(events);
  }

  /** Returns false when every event was already known. */
  add(incoming: readonly ProgressEvent[]): boolean {
    const fresh: ProgressEvent[] = [];
    for (const event of incoming) {
      if (this.ids.has(event.id)) continue;
      this.ids.add(event.id);
      fresh.push(event);
    }
    if (!fresh.length) return false;
    fresh.sort(compareEvents);
    this.events = [...this.events, ...fresh];

    const first = fresh[0]!;
    const last = fresh[fresh.length - 1]!;
    if (!this.newest || compareEvents(first, this.newest) > 0) {
      this.state = applyEvents(this.state, fresh);
      this.newest = last;
    } else {
      this.state = foldEvents(this.events);
      if (compareEvents(last, this.newest) > 0) this.newest = last;
    }
    return true;
  }
}
