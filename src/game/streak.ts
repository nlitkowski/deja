import { addDays, type DayKey } from '../lib/date';
import { compareEvents } from '../lib/progress/fold';
import type { ProgressEvent, SettingEvent } from '../lib/progress/events';
import { GAME } from './config';
import { xpByDay, type XpContext } from './xp';

export interface StreakInfo {
  /** Days in a row with the goal met (frozen days keep it alive but do not add to it). */
  current: number;
  best: number;
  freezes: number;
  todayXp: number;
  todayDone: boolean;
  goal: number;
}

/** The daily goal in force on each day: a change counts from the day it was made. */
export function goalResolver(events: readonly ProgressEvent[]): (day: DayKey) => number {
  const changes = events
    .filter((e): e is SettingEvent => e.type === 'setting' && e.key === 'dailyGoal')
    .sort(compareEvents);
  return (day) => {
    let goal: number = GAME.streak.defaultGoal;
    for (const change of changes) {
      if (change.day > day) break;
      goal = change.value;
    }
    return goal;
  };
}

/**
 * Walks every day from the first one with XP. A missed day uses a freeze if one is in stock;
 * a freeze is earned for every `freezeEvery` met days in a row. Today counts once met, and never breaks the streak.
 */
export function streakInfo(events: readonly ProgressEvent[], today: DayKey, ctx: XpContext): StreakInfo {
  const xp = xpByDay(events, ctx);
  const goalOn = goalResolver(events);
  const todayXp = xp.get(today) ?? 0;
  const goal = goalOn(today);
  const todayDone = todayXp >= goal;

  const days = [...xp.keys()].filter((d) => d <= today).sort();
  let current = 0;
  let best = 0;
  let freezes = 0;
  let run = 0;

  const meet = () => {
    current += 1;
    run += 1;
    best = Math.max(best, current);
    if (run % GAME.streak.freezeEvery === 0) freezes = Math.min(GAME.streak.maxFreezes, freezes + 1);
  };

  if (days.length) {
    for (let day = days[0]!; day < today; day = addDays(day, 1)) {
      if ((xp.get(day) ?? 0) >= goalOn(day)) meet();
      else if (current > 0 && freezes > 0) {
        freezes -= 1;
        run = 0;
      } else {
        current = 0;
        run = 0;
      }
    }
    if (todayDone) meet();
  }
  return { current, best, freezes, todayXp, todayDone, goal };
}
