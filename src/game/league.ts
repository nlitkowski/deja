import { addDays, diffDays, type DayKey } from '../lib/date';
import type { ProgressEvent } from '../lib/progress/events';
import { shuffle } from '../lib/session';
import { GAME } from './config';
import { seededRandom, weekStart } from './quests';
import { xpByDay, type XpContext } from './xp';

export interface LeagueRow {
  id: string;
  kind: 'you' | 'ghost' | 'bot';
  /** Bot name; for a ghost, how many weeks ago it ran. */
  name?: string;
  weeksAgo?: number;
  xp: number;
}

export interface LeagueWeek {
  week: DayKey;
  tier: number;
  rank: number;
}

export interface League {
  /** Index into `GAME.league.tiers`. */
  tier: number;
  week: DayKey;
  daysLeft: number;
  /** Ranked, best first. */
  rows: LeagueRow[];
  rank: number;
  /** Finished weeks, oldest first, with the tier they were played in. */
  history: LeagueWeek[];
}

const BOT_NAMES = ['Camille', 'Hugo', 'Léa', 'Louis', 'Manon', 'Théo', 'Chloé', 'Jules', 'Inès', 'Lucas', 'Zoé', 'Nathan', 'Emma', 'Arthur', 'Jade', 'Gabriel'];

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const kindOrder = { ghost: 0, bot: 1, you: 2 } as const;
/** Best first; a tie goes against the learner, so a week without XP is never a safe one. */
const byXp = (a: LeagueRow, b: LeagueRow) => b.xp - a.xp || kindOrder[a.kind] - kindOrder[b.kind] || a.id.localeCompare(b.id);

/**
 * A weekly race against yourself and a few bots. Ghosts are your own previous 4 weeks, over the same
 * number of days so far; bots run at your median week times a seeded factor, with seeded daily ups and downs.
 * Tiers are replayed week by week from the first week with XP: top 3 move up, last 2 move down.
 */
export function league(events: readonly ProgressEvent[], today: DayKey, ctx: XpContext): League {
  const byDay = xpByDay(events, ctx);
  const sumDays = (from: DayKey, days: number) => {
    let sum = 0;
    for (let i = 0; i < days; i++) sum += byDay.get(addDays(from, i)) ?? 0;
    return sum;
  };
  const activeDays = [...byDay.keys()].filter((d) => d <= today).sort();
  const firstWeek = activeDays.length ? weekStart(activeDays[0]!) : weekStart(today);
  const current = weekStart(today);
  const cfg = GAME.league;

  function table(week: DayKey, elapsed: number): LeagueRow[] {
    const previous = Array.from({ length: cfg.ghosts }, (_, i) => addDays(week, -7 * (i + 1)));
    const history = previous.filter((w) => w >= firstWeek).map((w) => sumDays(w, 7));
    const pace = median(history) || cfg.defaultPace;
    const random = seededRandom(`league:${week}`);
    const names = shuffle(BOT_NAMES, random).slice(0, cfg.bots);

    const rows: LeagueRow[] = [{ id: 'you', kind: 'you', xp: sumDays(week, elapsed) }];
    previous.forEach((w, i) => rows.push({ id: `ghost-${i + 1}`, kind: 'ghost', weeksAgo: i + 1, xp: w >= firstWeek ? sumDays(w, elapsed) : 0 }));
    names.forEach((name, i) => {
      const [low, high] = cfg.botFactor;
      const weekly = pace * (low + random() * (high - low));
      const daily = Array.from({ length: 7 }, () => 0.4 + random() * 1.2);
      const total = daily.reduce((a, b) => a + b, 0);
      const xp = daily.slice(0, elapsed).reduce((sum, d) => sum + (weekly * d) / total, 0);
      rows.push({ id: `bot-${i}`, kind: 'bot', name, xp: Math.round(xp) });
    });
    return rows.sort(byXp);
  }

  let tier = 0;
  const history: LeagueWeek[] = [];
  for (let week = firstWeek; week < current; week = addDays(week, 7)) {
    const rank = table(week, 7).findIndex((r) => r.kind === 'you') + 1;
    history.push({ week, tier, rank });
    const size = 1 + cfg.ghosts + cfg.bots;
    if (rank <= cfg.promote) tier = Math.min(cfg.tiers.length - 1, tier + 1);
    else if (rank > size - cfg.relegate) tier = Math.max(0, tier - 1);
  }

  const rows = table(current, diffDays(current, today) + 1);
  return { tier, week: current, daysLeft: 6 - diffDays(current, today), rows, rank: rows.findIndex((r) => r.kind === 'you') + 1, history };
}
