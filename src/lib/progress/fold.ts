import { GAME } from '../../game/config';
import { entryMastery } from '../../game/mastery';
import { addDays, type DayKey } from '../date';
import { cardKey, review, skillOfKey, type Skill, type SrsCard } from '../srs';
import { resolveEntryIds } from './aliases';
import { reviewSkill, type ProgressEvent } from './events';

export interface ProgressState {
  cards: Record<string, SrsCard>;
  /** Day each card (by card key) was first reviewed; '' for cards that came from a baseline (before history). */
  firstSeen: Record<string, DayKey>;
  /** New written cards counted on a day without per-card history (from a baseline). */
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

/** A first listening answer, right, about an entry already well known in writing: no need to start from a day. */
function knownInWriting(state: ProgressState, entryId: string, event: { grade: string }): boolean {
  return (event.grade === 'good' || event.grade === 'easy') && entryMastery(state.cards[cardKey(entryId)]) >= GAME.skills.knownStart.minWrittenMastery;
}

function knownStart(card: SrsCard, day: DayKey): SrsCard {
  const interval = Math.max(card.interval, GAME.skills.knownStart.interval);
  return { ...card, interval, due: addDays(day, interval) };
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

  const skill = reviewSkill(event);
  const entryIds = resolveEntryIds(event.entryIds);
  for (const id of entryIds) state.firstSeen[cardKey(id, skill)] ??= event.day;
  if (event.early && event.correct) return;
  for (const id of entryIds) {
    const key = cardKey(id, skill);
    const before = state.cards[key];
    const card = review(before, event.grade, event.day);
    state.cards[key] = !before && skill === 'listening' && knownInWriting(state, id, event) ? knownStart(card, event.day) : card;
  }
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
  return replayOnto(emptyProgress(), [...events].sort(compareEvents), visit);
}

/**
 * Continues a replay: applies `sorted` (in `compareEvents` order, all newer than what `state` holds) to `state`
 * in place, showing each event the state before it. For incremental projections that own their state.
 */
export function replayOnto(state: ProgressState, sorted: readonly ProgressEvent[], visit: (event: ProgressEvent, before: ProgressState) => void): ProgressState {
  for (const event of sorted) {
    visit(event, state);
    applyInPlace(state, event);
  }
  return state;
}

/** New cards of a skill first reviewed on a day: each skill has its own daily limit. */
export function newIntroducedOn(state: ProgressState, day: DayKey, skill: Skill = 'written'): number {
  let count = skill === 'written' ? (state.introducedExtra[day] ?? 0) : 0;
  for (const [key, seen] of Object.entries(state.firstSeen)) if (seen === day && skillOfKey(key) === skill) count += 1;
  return count;
}
