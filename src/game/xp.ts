import type { DayKey } from '../lib/date';
import type { ProgressEvent, ReviewEvent, SessionEvent } from '../lib/progress/events';
import { GAME } from './config';

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

export function answerXp(event: ReviewEvent, ctx: XpContext): AnswerXp {
  if (!event.correct) return { total: 0, combo: 0 };
  let xp = ctx.isProduction(event.exerciseId) ? GAME.xp.production : GAME.xp.recognition;
  if (!event.hintUsed) xp *= GAME.xp.noHint;
  if (event.nearMiss) xp *= GAME.xp.nearMiss;
  const plain = Math.round(xp);
  const total = Math.round(xp * comboMultiplier((event.comboBefore ?? 0) + 1));
  return { total, combo: total - plain };
}

export function sessionBonus(event: SessionEvent): number {
  const perfect = event.mistakes === 0 && event.items >= GAME.xp.perfectSessionMinItems;
  return GAME.xp.sessionComplete + (perfect ? GAME.xp.perfectSession : 0);
}

export function eventXp(event: ProgressEvent, ctx: XpContext): number {
  if (event.type === 'review') return answerXp(event, ctx).total;
  if (event.type === 'session') return sessionBonus(event);
  return 0;
}

export function totalXp(events: readonly ProgressEvent[], ctx: XpContext): number {
  let sum = 0;
  for (const event of events) sum += eventXp(event, ctx);
  return sum;
}

export function xpByDay(events: readonly ProgressEvent[], ctx: XpContext): Map<DayKey, number> {
  const days = new Map<DayKey, number>();
  for (const event of events) {
    const xp = eventXp(event, ctx);
    if (xp) days.set(event.day, (days.get(event.day) ?? 0) + xp);
  }
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
  for (const event of events) {
    if (event.type === 'review' && event.sessionId === sessionId) {
      const xp = answerXp(event, ctx);
      out.answers += xp.total - xp.combo;
      out.combo += xp.combo;
    } else if (event.type === 'session' && event.sessionId === sessionId) {
      out.bonus += sessionBonus(event);
    }
  }
  out.total = out.answers + out.combo + out.bonus;
  return out;
}
