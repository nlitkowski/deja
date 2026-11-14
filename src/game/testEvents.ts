import type { ReviewEvent, SessionEvent, SettingEvent } from '../lib/progress/events';

let seq = 0;
const nextId = () => `t${String(++seq).padStart(5, '0')}`;

export function answer(overrides: Partial<ReviewEvent> = {}): ReviewEvent {
  const day = overrides.day ?? '2026-11-14';
  return {
    type: 'review',
    id: nextId(),
    deviceId: 'd1',
    at: `${day}T10:00:00Z`,
    day,
    exerciseId: 'p/typed',
    entryIds: ['p/a'],
    grade: 'good',
    correct: true,
    nearMiss: false,
    hintUsed: false,
    timeMs: 5000,
    early: false,
    ...overrides,
  };
}

export function session(overrides: Partial<SessionEvent> = {}): SessionEvent {
  const day = overrides.day ?? '2026-11-14';
  return {
    type: 'session',
    id: nextId(),
    deviceId: 'd1',
    at: `${day}T10:30:00Z`,
    day,
    sessionId: 's1',
    kind: 'review',
    startedAt: `${day}T10:00:00Z`,
    items: 5,
    correct: 5,
    mistakes: 0,
    maxCombo: 5,
    ...overrides,
  };
}

export function goalChange(value: number, day: string): SettingEvent {
  return { type: 'setting', id: nextId(), deviceId: 'd1', at: `${day}T09:00:00Z`, day, key: 'dailyGoal', value };
}

export const ctx = { isProduction: (exerciseId: string) => exerciseId !== 'p/chosen' };
