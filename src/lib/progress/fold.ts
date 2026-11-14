import type { DayKey } from '../date';
import { review, type SrsCard } from '../srs';
import type { ProgressEvent } from './events';

export interface ProgressState {
  cards: Record<string, SrsCard>;
  /** Day each entry was first reviewed; '' for entries that came from a baseline (before history). */
  firstSeen: Record<string, DayKey>;
  /** New entries counted on a day without per-entry history (from a baseline). */
  introducedExtra: Record<DayKey, number>;
  eventCount: number;
}

export const emptyProgress = (): ProgressState => ({ cards: {}, firstSeen: {}, introducedExtra: {}, eventCount: 0 });

/** Total order shared by every device: by time, then by id. */
export function compareEvents(a: ProgressEvent, b: ProgressEvent): number {
  return a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Which of two copies of a card a baseline merge keeps. A total order on the card's fields,
 * so several baselines (one per device) merge to the same result in any order.
 */
function newerCard(a: SrsCard, b: SrsCard): SrsCard {
  const keys = ['lastReviewed', 'reps', 'correctTotal', 'interval', 'due', 'ease', 'lapses'] as const;
  for (const key of keys) if (a[key] !== b[key]) return a[key] > b[key] ? a : b;
  return a;
}

/** Applies an event in place. Only for states owned by the caller. */
function applyInPlace(state: ProgressState, event: ProgressEvent): void {
  state.eventCount += 1;

  if (event.type === 'baseline') {
    for (const [id, card] of Object.entries(event.cards)) {
      const current = state.cards[id];
      state.cards[id] = current ? newerCard(current, card) : card;
      state.firstSeen[id] ??= '';
    }
    if (event.introduced) {
      const { day, count } = event.introduced;
      // Baselines from different devices may count the same entries, so take the larger count.
      state.introducedExtra[day] = Math.max(state.introducedExtra[day] ?? 0, count);
    }
    return;
  }

  if (event.type !== 'review') return;

  for (const id of event.entryIds) state.firstSeen[id] ??= event.day;
  if (event.early && event.correct) return;
  for (const id of event.entryIds) state.cards[id] = review(state.cards[id], event.grade, event.day);
}

const copy = (state: ProgressState): ProgressState => ({
  cards: { ...state.cards },
  firstSeen: { ...state.firstSeen },
  introducedExtra: { ...state.introducedExtra },
  eventCount: state.eventCount,
});

/** Applies events that are already in `compareEvents` order and all newer than those in `state`. */
export function applyEvents(state: ProgressState, sorted: readonly ProgressEvent[]): ProgressState {
  const next = copy(state);
  for (const event of sorted) applyInPlace(next, event);
  return next;
}

export const applyEvent = (state: ProgressState, event: ProgressEvent): ProgressState => applyEvents(state, [event]);

export function foldEvents(events: readonly ProgressEvent[]): ProgressState {
  return applyEvents(emptyProgress(), [...events].sort(compareEvents));
}

/**
 * Folds the log in order and shows each event the state just before it, for projections that depend
 * on it (XP that drops for mastered entries). `before` is only valid during the call.
 */
export function replay(events: readonly ProgressEvent[], visit: (event: ProgressEvent, before: ProgressState) => void): ProgressState {
  const state = emptyProgress();
  for (const event of [...events].sort(compareEvents)) {
    visit(event, state);
    applyInPlace(state, event);
  }
  return state;
}

export function newIntroducedOn(state: ProgressState, day: DayKey): number {
  let count = state.introducedExtra[day] ?? 0;
  for (const seen of Object.values(state.firstSeen)) if (seen === day) count += 1;
  return count;
}
