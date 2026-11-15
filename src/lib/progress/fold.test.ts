import { describe, expect, it } from 'vitest';
import { review, type Grade, type SrsCard } from '../srs';
import { setEntryAliases } from './aliases';
import type { BaselineEvent, ProgressEvent, ReviewEvent } from './events';
import { applyEvent, compareEvents, emptyProgress, foldEvents, newIntroducedOn } from './fold';

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

function baseline(id: string, cards: Record<string, SrsCard>, introduced?: BaselineEvent['introduced']): BaselineEvent {
  return { type: 'baseline', id, deviceId: id, at: '2026-11-14T07:00:00Z', day: '2026-11-14', cards, introduced };
}

describe('several baselines', () => {
  it('keep the more recent copy of each card, whatever their order', () => {
    const older = review(undefined, 'good', '2026-11-01');
    const newer = review(older, 'good', '2026-11-05');
    const sameDayMoreReps = { ...newer, reps: newer.reps + 1 };
    const phone = baseline('phone', { 'p/a': newer, 'p/b': newer }, { day: '2026-11-14', count: 2 });
    const laptop = baseline('laptop', { 'p/a': older, 'p/b': sameDayMoreReps, 'p/c': older }, { day: '2026-11-14', count: 3 });

    const state = foldEvents([phone, laptop]);
    expect(state.cards).toEqual({ 'p/a': newer, 'p/b': sameDayMoreReps, 'p/c': older });
    expect(state.introducedExtra).toEqual({ '2026-11-14': 3 });
    expect(foldEvents([laptop, phone])).toEqual(state);

    // Same result even if the merge sees them the other way round (different timestamps).
    const swapped = foldEvents([{ ...phone, at: '2026-11-14T06:00:00Z' }, laptop]);
    expect(swapped.cards).toEqual(state.cards);
  });
});

function reference(events: readonly ProgressEvent[]) {
  return [...events].sort(compareEvents).reduce(applyEvent, emptyProgress());
}

function randomLog(count: number, entries: number, random: () => number): ProgressEvent[] {
  const grades: Grade[] = ['again', 'hard', 'good', 'easy'];
  const start = Date.parse('2026-01-01T08:00:00Z');
  return Array.from({ length: count }, (_, i) => {
    const at = new Date(start + Math.floor(random() * 300) * 86_400_000 + i * 1000);
    const grade = grades[Math.floor(random() * 4)]!;
    return {
      type: 'review',
      id: `r${i}`,
      deviceId: random() < 0.5 ? 'phone' : 'laptop',
      at: at.toISOString(),
      day: at.toISOString().slice(0, 10),
      exerciseId: 'p/x',
      entryIds: [`p/e${Math.floor(random() * entries)}`],
      grade,
      correct: grade !== 'again',
      nearMiss: false,
      hintUsed: false,
      timeMs: 5000,
      early: random() < 0.1,
    } satisfies ReviewEvent;
  });
}

function seeded(seed: number) {
  return () => ((seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31);
}

describe('fold performance', () => {
  it('matches the event-by-event fold on random logs', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const log = randomLog(400, 30, seeded(seed));
      expect(foldEvents(log)).toEqual(reference(log));
    }
  });

  it('folds 20 000 events over 500 entries quickly', () => {
    const log = randomLog(20_000, 500, seeded(42));
    const started = performance.now();
    foldEvents(log);
    expect(performance.now() - started).toBeLessThan(200);
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

describe('merged entries', () => {
  it('folds answers to a deprecated entry into the entry that replaced it, once per answer', () => {
    setEntryAliases(new Map([['p/old-1', 'p/new'], ['p/old-2', 'p/new']]));
    try {
      const events = [
        answer({ at: '2026-11-14T08:00:00Z', day: '2026-11-14', entryIds: ['p/old-1'] }),
        answer({ at: '2026-11-15T08:00:00Z', day: '2026-11-15', entryIds: ['p/old-2', 'p/old-1'] }),
        answer({ at: '2026-11-18T08:00:00Z', day: '2026-11-18', entryIds: ['p/new'] }),
      ];
      const state = foldEvents(events);
      expect(Object.keys(state.cards)).toEqual(['p/new']);
      expect(state.cards['p/new']!.reps).toBe(3);
      expect(state.firstSeen['p/new']).toBe('2026-11-14');
    } finally {
      setEntryAliases(new Map());
    }
  });
});
