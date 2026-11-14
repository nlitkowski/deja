import { describe, expect, it } from 'vitest';
import { addDays, dayKey, diffDays } from './date';

describe('dayKey', () => {
  it('counts the hours before 4:00 as the previous day', () => {
    expect(dayKey(new Date(2026, 0, 1, 3, 59))).toBe('2025-12-31');
    expect(dayKey(new Date(2026, 0, 1, 4, 0))).toBe('2026-01-01');
  });
});

describe('addDays / diffDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2026-03-28', '2026-04-02')).toBe(5);
  });
});
