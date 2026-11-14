import { describe, expect, it } from 'vitest';
import type { ReviewEvent } from './events';
import { foldEvents } from './fold';
import { Projection } from './projection';

function answer(id: string, at: string, entry = 'p/a'): ReviewEvent {
  return {
    type: 'review',
    id,
    deviceId: 'd1',
    at,
    day: at.slice(0, 10),
    exerciseId: 'p/x',
    entryIds: [entry],
    grade: 'good',
    correct: true,
    nearMiss: false,
    hintUsed: false,
    timeMs: 5000,
    early: false,
  };
}

describe('Projection', () => {
  const a = answer('a', '2026-11-10T08:00:00Z');
  const b = answer('b', '2026-11-12T08:00:00Z');
  const c = answer('c', '2026-11-14T08:00:00Z', 'p/b');

  it('applies newer events on top of the last state', () => {
    const projection = new Projection([a]);
    expect(projection.add([b, c])).toBe(true);
    expect(projection.state).toEqual(foldEvents([a, b, c]));
  });

  it('refolds when an older event arrives from another device', () => {
    const projection = new Projection([a, c]);
    projection.add([b]);
    expect(projection.state).toEqual(foldEvents([a, b, c]));
  });

  it('ignores events it already has', () => {
    const projection = new Projection([a, b]);
    const before = projection.state;
    expect(projection.add([a, b])).toBe(false);
    expect(projection.state).toBe(before);
  });
});
