import { resolveEntryIds } from '../lib/progress/aliases';
import { reviewSkill, type ProgressEvent } from '../lib/progress/events';
import { compareEvents, emptyProgress, replayOnto, type ProgressState } from '../lib/progress/fold';
import { unitMastery, type Mastery } from './mastery';

export interface PeakUnit {
  key: string;
  /** Without deprecated entries. */
  entryIds: readonly string[];
}

export type Peaks = ReadonlyMap<string, Mastery>;

/**
 * The highest crown each unit ever had, from the log: crowns only move on written reviews (and baselines), so
 * replaying the log and taking the crown after each one finds every peak. Incremental like the XP scorer;
 * a replay from scratch (an older event synced in) keeps the peaks already found, so a peak never drops.
 */
class PeakTracker {
  private log: readonly ProgressEvent[] = [];
  private state: ProgressState = emptyProgress();
  private newest: ProgressEvent | undefined;
  private peaks = new Map<string, Mastery>();
  private readonly byEntry = new Map<string, PeakUnit[]>();
  private readonly cache = new WeakMap<readonly ProgressEvent[], Peaks>();

  constructor(private readonly units: readonly PeakUnit[]) {
    for (const unit of units) for (const id of unit.entryIds) this.byEntry.set(id, [...(this.byEntry.get(id) ?? []), unit]);
  }

  peaksOf(log: readonly ProgressEvent[]): Peaks {
    const cached = this.cache.get(log);
    if (cached) return cached;
    const added = this.isPrefixOf(log) ? [...log.slice(this.log.length)].sort(compareEvents) : null;
    if (added && (!added.length || !this.newest || compareEvents(added[0]!, this.newest) > 0)) {
      this.replay(added);
    } else {
      this.state = emptyProgress();
      this.newest = undefined;
      this.replay([...log].sort(compareEvents));
    }
    this.log = log;
    const peaks = new Map(this.peaks);
    this.cache.set(log, peaks);
    return peaks;
  }

  private isPrefixOf(log: readonly ProgressEvent[]): boolean {
    if (log.length < this.log.length) return false;
    for (let i = 0; i < this.log.length; i++) if (log[i] !== this.log[i]) return false;
    return true;
  }

  private replay(sorted: readonly ProgressEvent[]): void {
    let touched: readonly PeakUnit[] = [];
    const settle = (state: ProgressState) => {
      for (const unit of touched) {
        const crown = unitMastery(unit.entryIds, state.cards);
        if (crown > (this.peaks.get(unit.key) ?? 0)) this.peaks.set(unit.key, crown);
      }
      touched = [];
    };
    replayOnto(this.state, sorted, (event, before) => {
      settle(before);
      if (event.type === 'baseline') touched = this.units;
      else if (event.type === 'review' && reviewSkill(event) === 'written') {
        touched = [...new Set(resolveEntryIds(event.entryIds).flatMap((id) => this.byEntry.get(id) ?? []))];
      }
    });
    settle(this.state);
    if (sorted.length) this.newest = sorted[sorted.length - 1];
  }
}

const trackers = new WeakMap<readonly PeakUnit[], PeakTracker>();

/**
 * Peaks of the given units, at least `remembered` (peaks seen earlier on this device: they survive new entries
 * added to a unit and older events synced in later, which would lower a replayed peak).
 */
export function unitPeaks(log: readonly ProgressEvent[], units: readonly PeakUnit[], remembered: Peaks = new Map()): Peaks {
  let tracker = trackers.get(units);
  if (!tracker) trackers.set(units, (tracker = new PeakTracker(units)));
  const peaks = tracker.peaksOf(log);
  if (![...remembered].some(([key, level]) => level > (peaks.get(key) ?? 0))) return peaks;
  const merged = new Map(peaks);
  for (const [key, level] of remembered) if (level > (merged.get(key) ?? 0)) merged.set(key, level);
  return merged;
}
