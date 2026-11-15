import { addDays, diffDays, type DayKey } from '../../lib/date';
import type { ProgressEvent, ReviewEvent, SessionEvent } from '../../lib/progress/events';
import { shuffle } from '../../lib/session';
import type { SrsCard } from '../../lib/srs';
import { GAME } from '../config';
import { goalResolver } from '../streak';
import { scoreEvents, type XpContext } from '../xp';
import type { Quest, QuestDigest, QuestModule } from './types';

export type { Quest, QuestDigest } from './types';

const pool = (modules: Record<string, QuestModule>) =>
  Object.keys(modules)
    .sort()
    .map((file) => modules[file]!.default);

/** One file per quest in `daily/` and `weekly/`: adding a quest is adding a file. */
export const DAILY_QUESTS: readonly Quest[] = pool(import.meta.glob<QuestModule>('./daily/*.ts', { eager: true }));
export const WEEKLY_QUESTS: readonly Quest[] = pool(import.meta.glob<QuestModule>('./weekly/*.ts', { eager: true }));

/** Monday of the learning week. */
export function weekStart(day: DayKey): DayKey {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

/** Seeded generator (FNV-1a hash of the seed, then mulberry32): the same quests on every device. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The draw does not depend on `quiet`, so turning it on swaps listening quests in place and changes nothing else. */
export function questsFor(today: DayKey, { quiet = false } = {}): { quest: Quest; period: DayKey }[] {
  const week = weekStart(today);
  const playable = (quest: Quest) => (quiet && quest.quietFallback) || quest;
  return [
    ...shuffle(DAILY_QUESTS, seededRandom(`day:${today}`))
      .slice(0, GAME.quests.daily)
      .map((quest) => ({ quest: playable(quest), period: today })),
    ...shuffle(WEEKLY_QUESTS, seededRandom(`week:${week}`))
      .slice(0, GAME.quests.weekly)
      .map((quest) => ({ quest: playable(quest), period: week })),
  ];
}

export interface DigestContext extends XpContext {
  isTricky: (entryId: string) => boolean;
  /** Quiet mode: listening quests give way to their written fallback. */
  quiet?: boolean;
}

export function questDigest(events: readonly ProgressEvent[], from: DayKey, to: DayKey, ctx: DigestContext): QuestDigest {
  const inPeriod = (day: DayKey) => day >= from && day <= to;
  const reviews: { event: ReviewEvent; before: SrsCard[] }[] = [];
  const sessions: SessionEvent[] = [];
  const xpOn = new Map<DayKey, number>();
  for (const { event, xp, before } of scoreEvents(events, ctx)) {
    if (!inPeriod(event.day)) continue;
    if (event.type === 'review') reviews.push({ event, before: before ?? [] });
    if (event.type === 'session') sessions.push(event);
    // A quest's own reward does not count towards the quests.
    if (event.type !== 'quest') xpOn.set(event.day, (xpOn.get(event.day) ?? 0) + xp);
  }
  const goalOn = goalResolver(events);
  const days = Array.from({ length: diffDays(from, to) + 1 }, (_, i) => addDays(from, i)).map((day) => ({ day, xp: xpOn.get(day) ?? 0, goal: goalOn(day) }));
  return { reviews, sessions, xp: days.reduce((sum, d) => sum + d.xp, 0), days, isProduction: ctx.isProduction, exerciseType: (id) => ctx.exerciseType?.(id), isTricky: ctx.isTricky };
}

export interface QuestStatus {
  quest: Quest;
  period: DayKey;
  progress: number;
  target: number;
  done: boolean;
  claimed: boolean;
  reward: number;
}

/** Today's three quests and the week's one, with progress from the log. */
export function questStatus(events: readonly ProgressEvent[], today: DayKey, ctx: DigestContext): QuestStatus[] {
  const claimed = new Set(events.flatMap((e) => (e.type === 'quest' ? [`${e.questId}@${e.period}`] : [])));
  const digests = new Map<DayKey, QuestDigest>();
  return questsFor(today, { quiet: ctx.quiet }).map(({ quest, period }) => {
    if (!digests.has(period)) digests.set(period, questDigest(events, period, today, ctx));
    const digest = digests.get(period)!;
    const target = quest.target(digest);
    const progress = Math.min(quest.progress(digest), target);
    return {
      quest,
      period,
      progress,
      target,
      done: progress >= target,
      claimed: claimed.has(`${quest.id}@${period}`),
      reward: quest.period === 'day' ? GAME.quests.dailyReward : GAME.quests.weeklyReward,
    };
  });
}
