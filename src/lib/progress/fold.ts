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

export function applyEvent(state: ProgressState, event: ProgressEvent): ProgressState {
  const eventCount = state.eventCount + 1;

  if (event.type === 'baseline') {
    const firstSeen = { ...state.firstSeen };
    for (const id of Object.keys(event.cards)) firstSeen[id] ??= '';
    const introducedExtra = { ...state.introducedExtra };
    if (event.introduced) {
      introducedExtra[event.introduced.day] = (introducedExtra[event.introduced.day] ?? 0) + event.introduced.count;
    }
    return { cards: { ...state.cards, ...event.cards }, firstSeen, introducedExtra, eventCount };
  }

  const firstSeen = { ...state.firstSeen };
  for (const id of event.entryIds) firstSeen[id] ??= event.day;
  if (event.early && event.correct) return { ...state, firstSeen, eventCount };

  const cards = { ...state.cards };
  for (const id of event.entryIds) cards[id] = review(cards[id], event.grade, event.day);
  return { ...state, cards, firstSeen, eventCount };
}

export function foldEvents(events: readonly ProgressEvent[]): ProgressState {
  return [...events].sort(compareEvents).reduce(applyEvent, emptyProgress());
}

export function newIntroducedOn(state: ProgressState, day: DayKey): number {
  let count = state.introducedExtra[day] ?? 0;
  for (const seen of Object.values(state.firstSeen)) if (seen === day) count += 1;
  return count;
}
