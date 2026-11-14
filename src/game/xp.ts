import type { DayKey } from '../lib/date';
import type { ProgressEvent, ReviewEvent, SessionEvent } from '../lib/progress/events';
import { compareEvents, emptyProgress, replayOnto, type ProgressState } from '../lib/progress/fold';
import { cardKey, type SrsCard } from '../lib/srs';
import { GAME } from './config';
import { entryMastery } from './mastery';

export interface XpContext {
  /** Whether the exercise is typed (production) rather than chosen. */
  isProduction: (exerciseId: string) => boolean;
}

export interface AnswerXp {
  total: number;
  /** Part of `total` that comes from the combo multiplier. */
  combo: number;
}

export function comboMultiplier(combo: number): number {
  return GAME.xp.combo.find((step) => combo >= step.from)?.multiplier ?? 1;
}

/** Whether every entry of an answer was already at the top mastery before it. */
export const allMastered = (entryIds: readonly string[], cards: Readonly<Record<string, SrsCard>>) =>
  entryIds.every((id) => entryMastery(cards[cardKey(id)]) === 5);

/** `mastered`: every entry of the answer was at mastery 5 before it, so it is worth less. */
export function answerXp(event: ReviewEvent, ctx: XpContext, mastered = false): AnswerXp {
  if (!event.correct) return { total: 0, combo: 0 };
  let xp = (event.production ?? ctx.isProduction(event.exerciseId)) ? GAME.xp.production : GAME.xp.recognition;
  if (!event.hintUsed) xp *= GAME.xp.noHint;
  if (event.nearMiss) xp *= GAME.xp.nearMiss;
  if (mastered) xp *= GAME.xp.masteredMultiplier;
  const plain = Math.round(xp);
  const total = Math.round(xp * comboMultiplier((event.comboBefore ?? 0) + 1));
  return { total, combo: total - plain };
}

export function sessionBonus(event: SessionEvent): number {
  const perfect = event.mistakes === 0 && event.items >= GAME.xp.perfectSessionMinItems;
  return GAME.xp.sessionComplete + (perfect ? GAME.xp.perfectSession : 0) + (event.defeated ? GAME.xp.bossDefeated : 0);
}

export interface ScoredEvent {
  event: ProgressEvent;
  xp: number;
  /** Part of `xp` from the combo multiplier. */
  combo: number;
  /** Review events only: the cards of its entries just before it (entries never seen are left out). */
  before?: SrsCard[];
}

/**
 * Scores a growing log incrementally, the way Projection folds SRS: a log that only adds newer events
 * scores just those on top of the kept state; anything else (an older event synced from another device)
 * rescores from scratch. Results are cached per log array, which the store replaces rather than mutates.
 */
class Scorer {
  private log: readonly ProgressEvent[] = [];
  private scored: ScoredEvent[] = [];
  private state: ProgressState = emptyProgress();
  private newest: ProgressEvent | undefined;
  /** Business keys of rewards already paid: a quest per period, a session's bonus. */
  private paid = new Set<string>();
  private readonly cache = new WeakMap<readonly ProgressEvent[], ScoredEvent[]>();

  constructor(private readonly ctx: XpContext) {}

  score(log: readonly ProgressEvent[]): ScoredEvent[] {
    const cached = this.cache.get(log);
    if (cached) return cached;
    const added = this.isPrefixOf(log) ? [...log.slice(this.log.length)].sort(compareEvents) : null;
    if (added && (!added.length || !this.newest || compareEvents(added[0]!, this.newest) > 0)) {
      this.scored = [...this.scored, ...this.replay(added)];
    } else {
      this.state = emptyProgress();
      this.newest = undefined;
      this.paid = new Set();
      this.scored = this.replay([...log].sort(compareEvents));
    }
    this.log = log;
    this.cache.set(log, this.scored);
    return this.scored;
  }

  private firstPayment(key: string): boolean {
    if (this.paid.has(key)) return false;
    this.paid.add(key);
    return true;
  }

  private isPrefixOf(log: readonly ProgressEvent[]): boolean {
    if (log.length < this.log.length) return false;
    for (let i = 0; i < this.log.length; i++) if (log[i] !== this.log[i]) return false;
    return true;
  }

  private replay(sorted: readonly ProgressEvent[]): ScoredEvent[] {
    const out: ScoredEvent[] = [];
    replayOnto(this.state, sorted, (event, before) => {
      if (event.type === 'review') {
        const { total, combo } = answerXp(event, this.ctx, allMastered(event.entryIds, before.cards));
        out.push({ event, xp: total, combo, before: event.entryIds.flatMap((id) => before.cards[cardKey(id)] ?? []) });
      } else if (event.type === 'session') {
        out.push({ event, xp: this.firstPayment(`session:${event.sessionId}`) ? sessionBonus(event) : 0, combo: 0 });
      } else if (event.type === 'quest') {
        // Two devices offline can both claim a quest; only the first claim in the shared order pays.
        out.push({ event, xp: this.firstPayment(`quest:${event.questId}@${event.period}`) ? event.xp : 0, combo: 0 });
      }
    });
    if (sorted.length) this.newest = sorted[sorted.length - 1];
    return out;
  }
}

// One scorer per way of telling production from recognition: contexts that share it (quests extend
// the XP context) share the work.
const scorers = new WeakMap<XpContext['isProduction'], Scorer>();

/** XP of every event, in log order. Mastery depends on what came before, so scoring replays the log. */
export function scoreEvents(events: readonly ProgressEvent[], ctx: XpContext): readonly ScoredEvent[] {
  let scorer = scorers.get(ctx.isProduction);
  if (!scorer) scorers.set(ctx.isProduction, (scorer = new Scorer(ctx)));
  return scorer.score(events);
}

export function totalXp(events: readonly ProgressEvent[], ctx: XpContext): number {
  return scoreEvents(events, ctx).reduce((sum, s) => sum + s.xp, 0);
}

const daysCache = new WeakMap<readonly ScoredEvent[], ReadonlyMap<DayKey, number>>();

export function xpByDay(events: readonly ProgressEvent[], ctx: XpContext): ReadonlyMap<DayKey, number> {
  const scored = scoreEvents(events, ctx);
  const cached = daysCache.get(scored);
  if (cached) return cached;
  const days = new Map<DayKey, number>();
  for (const { event, xp } of scored) if (xp) days.set(event.day, (days.get(event.day) ?? 0) + xp);
  daysCache.set(scored, days);
  return days;
}

export interface SessionXp {
  answers: number;
  combo: number;
  bonus: number;
  total: number;
}

/** XP earned in one session, split for the summary screen. */
export function sessionXp(events: readonly ProgressEvent[], sessionId: string, ctx: XpContext): SessionXp {
  const out = { answers: 0, combo: 0, bonus: 0, total: 0 };
  for (const { event, xp, combo } of scoreEvents(events, ctx)) {
    if (event.type === 'review' && event.sessionId === sessionId) {
      out.answers += xp - combo;
      out.combo += combo;
    } else if (event.type === 'session' && event.sessionId === sessionId) {
      out.bonus += xp;
    }
  }
  out.total = out.answers + out.combo + out.bonus;
  return out;
}
