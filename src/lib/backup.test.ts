import { describe, expect, it } from 'vitest';
import { backupFileName, createBackup, missingEvents, parseBackup } from './backup';
import type { ProgressEvent, ReviewEvent } from './progress/events';
import { defaultSettings } from './storage';

const review = (id: string): ReviewEvent => ({
  type: 'review',
  id,
  deviceId: 'd1',
  at: '2026-11-14T10:00:00.000Z',
  day: '2026-11-14',
  exerciseId: 'p/x',
  entryIds: ['p/e'],
  grade: 'good',
  correct: true,
  nearMiss: false,
  hintUsed: false,
  timeMs: 3000,
  early: false,
});

const all: ProgressEvent[] = [
  review('r1'),
  { type: 'session', id: 's1', deviceId: 'd1', at: '2026-11-14T10:05:00.000Z', day: '2026-11-14', sessionId: 'x', kind: 'unit', unitKey: 'p/u', startedAt: '2026-11-14T10:00:00.000Z', items: 1, correct: 1, mistakes: 0, maxCombo: 1 },
  { type: 'setting', id: 'g1', deviceId: 'd1', at: '2026-11-14T09:00:00.000Z', day: '2026-11-14', key: 'dailyGoal', value: 100 },
  { type: 'quest', id: 'q1', deviceId: 'd1', at: '2026-11-14T11:00:00.000Z', day: '2026-11-14', questId: 'daily/x', period: '2026-11-14', xp: 20 },
  {
    type: 'baseline',
    id: 'b1',
    deviceId: 'd1',
    at: '2026-11-01T00:00:00.000Z',
    day: '2026-11-01',
    cards: { 'p/e': { ease: 2.5, interval: 1, due: '2026-11-02', reps: 1, lapses: 0, correctTotal: 1, lastReviewed: '2026-11-01' } },
  },
];

describe('backup', () => {
  it('round-trips every event type and the settings', () => {
    const settings = { ...defaultSettings(), palette: 'pixel' as const, dailyGoal: 100 as const };
    const text = JSON.stringify(createBackup(all, settings, new Date('2026-11-14T12:00:00Z')));
    expect(parseBackup(text)).toEqual({ ok: true, events: all, settings, exportedAt: '2026-11-14T12:00:00.000Z' });
  });

  it('names the file after the day', () => {
    expect(backupFileName('2026-11-14')).toBe('deja-sauvegarde-2026-11-14.json');
  });

  it('refuses files that are not a backup, damaged ones and ones from a newer version', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, reason: 'notBackup' });
    expect(parseBackup('{"hello":1}')).toEqual({ ok: false, reason: 'notBackup' });
    const backup = createBackup([review('r1')], defaultSettings(), new Date());
    expect(parseBackup(JSON.stringify({ ...backup, version: 99 }))).toEqual({ ok: false, reason: 'newerVersion' });
    expect(parseBackup(JSON.stringify({ ...backup, events: [{ ...review('r1'), grade: 'great' }] }))).toEqual({ ok: false, reason: 'damaged' });
  });

  it('keeps the valid settings of a backup and drops unknown values', () => {
    const backup = { ...createBackup([], defaultSettings(), new Date()), settings: { palette: 'neon', helpLang: 'fr', extra: 1 } };
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok && parsed.settings).toEqual({ helpLang: 'fr' });
  });
});

describe('missingEvents', () => {
  it('returns only events the log does not have, once each', () => {
    expect(missingEvents([review('r1')], [review('r1'), review('r2'), review('r2')]).map((e) => e.id)).toEqual(['r2']);
  });
});
