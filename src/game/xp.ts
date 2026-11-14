import type { DayKey } from '../lib/date';
import type { ProgressEvent, ReviewEvent, SessionEvent } from '../lib/progress/events';
import { replay } from '../lib/progress/fold';
import type { SrsCard } from '../lib/srs';
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
  entryIds.every((id) => entryMastery(cards[id]) === 5);

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
}

/** XP of every event. Mastery depends on what came before, so this replays the log in order. */
export function scoreEvents(events: readonly ProgressEvent[], ctx: XpContext): ScoredEvent[] {
  const scored: ScoredEvent[] = [];
  replay(events, (event, before) => {
    if (event.type === 'review') {
      const { total, combo } = answerXp(event, ctx, allMastered(event.entryIds, before.cards));
      scored.push({ event, xp: total, combo });
    } else if (event.type === 'session') {
      scored.push({ event, xp: sessionBonus(event), combo: 0 });
    }
  });
  return scored;
}

export function totalXp(events: readonly ProgressEvent[], ctx: XpContext): number {
  return scoreEvents(events, ctx).reduce((sum, s) => sum + s.xp, 0);
}

export function xpByDay(events: readonly ProgressEvent[], ctx: XpContext): Map<DayKey, number> {
  const days = new Map<DayKey, number>();
  for (const { event, xp } of scoreEvents(events, ctx)) if (xp) days.set(event.day, (days.get(event.day) ?? 0) + xp);
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
