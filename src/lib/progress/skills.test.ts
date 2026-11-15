import { describe, expect, it } from 'vitest';
import { scoreEvents } from '../../game/xp';
import { unitMastery } from '../../game/mastery';
import { cardKey } from '../srs';
import type { ProgressEvent, ReviewEvent } from './events';
import { foldEvents, newIntroducedOn } from './fold';
import { parseEvent } from './schema';
import savedLog from './__fixtures__/written-log.json';
import savedProjection from './__fixtures__/written-log.projection.json';

describe('a log written before skills existed', () => {
  // Fixture and expected projection were saved by the code before skills were added; regenerating them defeats the test.
  const log = (savedLog as unknown[]).map(parseEvent);

  it('still parses', () => {
    expect(log.every(Boolean)).toBe(true);
  });

  it('projects exactly as it did', () => {
    const events = log as ProgressEvent[];
    const state = foldEvents(events);
    const days = [...new Set(events.map((e) => e.day))];
    expect(JSON.parse(JSON.stringify(state))).toEqual(savedProjection.state);
    expect(Object.fromEntries(days.map((d) => [d, newIntroducedOn(state, d)]))).toEqual(savedProjection.introduced);
    const ctx = { isProduction: (e: string) => !e.includes('~') };
    expect(scoreEvents(events, ctx).map((x) => [x.event.id, x.xp, x.combo, x.before?.length ?? null])).toEqual(savedProjection.xp);
  });
});

const answer = (id: string, overrides: Partial<ReviewEvent> = {}): ReviewEvent => ({
  type: 'review',
  id,
  deviceId: 'd1',
  at: `2026-11-14T08:00:0${id.length}Z`,
  day: '2026-11-14',
  exerciseId: 'p/x',
  entryIds: ['p/a'],
  grade: 'good',
  correct: true,
  nearMiss: false,
  hintUsed: false,
  timeMs: 4000,
  early: false,
  ...overrides,
});

describe('skills', () => {
  it('keep separate cards: a listening answer leaves the written card alone', () => {
    const written = foldEvents([answer('w')]);
    const both = foldEvents([answer('w'), answer('ll', { skill: 'listening', grade: 'again', correct: false })]);
    expect(both.cards['p/a']).toEqual(written.cards['p/a']);
    expect(both.cards[cardKey('p/a', 'listening')]?.lapses).toBe(1);
    expect(both.cards[cardKey('p/a', 'speaking')]).toBeUndefined();
    expect(unitMastery(['p/a'], both.cards)).toBe(unitMastery(['p/a'], written.cards));
  });

  it('count new cards per skill', () => {
    const state = foldEvents([answer('w'), answer('ll', { skill: 'listening', entryIds: ['p/a', 'p/b'] })]);
    expect(newIntroducedOn(state, '2026-11-14')).toBe(1);
    expect(newIntroducedOn(state, '2026-11-14', 'listening')).toBe(2);
    expect(newIntroducedOn(state, '2026-11-14', 'speaking')).toBe(0);
  });

  it('are validated in events', () => {
    expect(parseEvent(answer('a', { skill: 'speaking' }))).not.toBeNull();
    expect(parseEvent({ ...answer('a'), skill: 'reading' })).toBeNull();
  });
});

describe('a first listening answer', () => {
  const known = (interval: number) => ({ ease: 2.5, interval, due: '2026-12-01', reps: 4, lapses: 0, correctTotal: 4, lastReviewed: '2026-11-01' });
  const baseline = (interval: number): ProgressEvent => ({ type: 'baseline', id: 'b', deviceId: 'd1', at: '2026-11-14T07:00:00Z', day: '2026-11-14', cards: { 'p/a': known(interval) } });

  it('starts at three days when the entry is well known in writing', () => {
    const state = foldEvents([baseline(7), answer('l', { skill: 'listening' })]);
    expect(state.cards['p/a#listening']).toMatchObject({ interval: 3, due: '2026-11-17' });
  });

  it('starts at one day otherwise, or after a hesitant or wrong answer', () => {
    expect(foldEvents([baseline(3), answer('l', { skill: 'listening' })]).cards['p/a#listening']?.interval).toBe(1);
    expect(foldEvents([baseline(7), answer('l', { skill: 'listening', grade: 'hard' })]).cards['p/a#listening']?.interval).toBe(1);
    expect(foldEvents([baseline(7), answer('l', { skill: 'listening', grade: 'again', correct: false })]).cards['p/a#listening']?.interval).toBe(0);
  });

  it('only applies to the first answer', () => {
    const state = foldEvents([baseline(7), answer('l', { skill: 'listening', grade: 'again', correct: false }), answer('ll', { skill: 'listening' })]);
    expect(state.cards['p/a#listening']?.interval).toBe(1);
  });
});
