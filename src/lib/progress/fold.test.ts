import { describe, expect, it } from 'vitest';
import { review } from '../srs';
import type { BaselineEvent, ReviewEvent } from './events';
import { applyEvent, emptyProgress, foldEvents, newIntroducedOn } from './fold';

let seq = 0;
function answer(overrides: Partial<ReviewEvent> & Pick<ReviewEvent, 'at' | 'day'>): ReviewEvent {
  seq += 1;
  return {
    type: 'review',
    id: `e${String(seq).padStart(4, '0')}`,
    deviceId: 'd1',
    exerciseId: 'p/x',
    entryIds: ['p/a'],
    grade: 'good',
    correct: true,
    nearMiss: false,
    hintUsed: false,
    timeMs: 4000,
    early: false,
    ...overrides,
  };
}

describe('foldEvents', () => {
  it('replays reviews into the same cards as calling review() directly', () => {
    const events = [
      answer({ at: '2026-11-14T08:00:00Z', day: '2026-11-14' }),
      answer({ at: '2026-11-15T08:00:00Z', day: '2026-11-15' }),
      answer({ at: '2026-11-18T08:00:00Z', day: '2026-11-18', grade: 'again', correct: false }),
    ];
    let card = review(undefined, 'good', '2026-11-14');
    card = review(card, 'good', '2026-11-15');
    card = review(card, 'again', '2026-11-18');
    expect(foldEvents(events).cards['p/a']).toEqual(card);
  });

  it('gives the same result whatever order the events arrive in (merged devices)', () => {
    const events = [
      answer({ at: '2026-11-14T08:00:00Z', day: '2026-11-14', deviceId: 'phone' }),
      answer({ at: '2026-11-14T09:00:00Z', day: '2026-11-14', entryIds: ['p/b'], deviceId: 'laptop' }),
      answer({ at: '2026-11-16T07:00:00Z', day: '2026-11-16', grade: 'hard', deviceId: 'laptop' }),
      answer({ at: '2026-11-16T07:00:00Z', day: '2026-11-16', entryIds: ['p/b'], grade: 'easy', deviceId: 'phone' }),
    ];
    const forward = foldEvents(events);
    expect(foldEvents([...events].reverse())).toEqual(forward);
    expect(foldEvents([events[2]!, events[0]!, events[3]!, events[1]!])).toEqual(forward);
  });

  it('leaves the schedule alone for correct early practice, but not for a mistake', () => {
    const first = answer({ at: '2026-11-14T08:00:00Z', day: '2026-11-14' });
    const base = foldEvents([first]);
    const earlyOk = applyEvent(base, answer({ at: '2026-11-14T09:00:00Z', day: '2026-11-14', early: true }));
    expect(earlyOk.cards).toEqual(base.cards);
    const earlyBad = applyEvent(base, answer({ at: '2026-11-14T09:00:00Z', day: '2026-11-14', early: true, correct: false, grade: 'again' }));
    expect(earlyBad.cards['p/a']?.reps).toBe(0);
  });

  it('applies reviews on top of a baseline imported from older storage', () => {
    const card = review(undefined, 'good', '2026-11-01');
    const baseline: BaselineEvent = {
      type: 'baseline',
      id: 'b1',
      deviceId: 'd1',
      at: '2026-11-14T07:00:00Z',
      day: '2026-11-14',
      cards: { 'p/a': card },
      introduced: { day: '2026-11-14', count: 2 },
    };
    const state = foldEvents([baseline, answer({ at: '2026-11-14T08:00:00Z', day: '2026-11-14' })]);
    expect(state.cards['p/a']).toEqual(review(card, 'good', '2026-11-14'));
    expect(state.firstSeen['p/a']).toBe('');
  });
});

describe('newIntroducedOn', () => {
  it('counts entries first reviewed that day plus baseline carry-over', () => {
    const state = foldEvents([
      answer({ at: '2026-11-13T08:00:00Z', day: '2026-11-13', entryIds: ['p/old'] }),
      answer({ at: '2026-11-14T08:00:00Z', day: '2026-11-14', entryIds: ['p/a', 'p/b'] }),
      answer({ at: '2026-11-14T09:00:00Z', day: '2026-11-14', entryIds: ['p/old'] }),
    ]);
    expect(newIntroducedOn(state, '2026-11-14')).toBe(2);
    expect(newIntroducedOn(state, '2026-11-13')).toBe(1);
    expect(newIntroducedOn(emptyProgress(), '2026-11-14')).toBe(0);
  });
});
