/** Calendar day as `YYYY-MM-DD`. Comparable as a string. */
export type DayKey = string;

export const DAY_RESET_HOUR = 4;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local-time day; before the reset hour the night still counts as the previous day. */
export function dayKey(now: Date, resetHour = DAY_RESET_HOUR): DayKey {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getHours() < resetHour ? 1 : 0));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toUtc(key: DayKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!);
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = new Date(toUtc(key) + days * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function diffDays(from: DayKey, to: DayKey): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}
