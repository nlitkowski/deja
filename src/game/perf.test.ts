import { describe, expect, it } from 'vitest';
import { addDays } from '../lib/date';
import type { ProgressEvent, ReviewEvent } from '../lib/progress/events';
import { Projection } from '../lib/progress/projection';
import { achievementStats } from './achievements';
import { league } from './league';
import { defeatedBosses, mapState, type MapPack } from './map';
import { questStatus } from './quests';
import { streakInfo } from './streak';
import { scoreEvents, totalXp, type XpContext } from './xp';

const ENTRIES = 500;
const EVENTS = 20_000;
const START = '2026-01-01';
const packs: MapPack[] = [{ id: 'p', requires: [], units: Array.from({ length: 25 }, (_, u) => ({ key: `p/u${u}`, entryIds: Array.from({ length: 20 }, (_, i) => `p/e${u * 20 + i}`) })) }];
const units = packs[0]!.units;

/** About 80 answers a day for 250 days, with a session event after every 20 answers. */
function bigLog(): ProgressEvent[] {
  const log: ProgressEvent[] = [];
  for (let i = 0; i < EVENTS; i++) {
    const day = addDays(START, Math.floor(i / 80));
    const at = `${day}T${String(8 + Math.floor((i % 80) / 8)).padStart(2, '0')}:${String((i % 8) * 7).padStart(2, '0')}:00.000Z`;
    if (i % 21 === 20) {
      log.push({ type: 'session', id: `e${i}`, deviceId: 'd', at, day, sessionId: `s${i}`, kind: 'review', startedAt: at, items: 20, correct: 18, mistakes: 2, maxCombo: 9 });
    } else {
      log.push(review(i, day, at));
    }
  }
  return log;
}

function review(i: number, day: string, at: string): ReviewEvent {
  const correct = i % 7 !== 0;
  return { type: 'review', id: `e${i}`, deviceId: 'd', at, day, exerciseId: 'p/x', entryIds: [`p/e${(i * 37) % ENTRIES}`], grade: correct ? 'good' : 'again', correct, nearMiss: false, hintUsed: false, timeMs: 4000, early: false, sessionId: 's', comboBefore: i % 12 };
}

const today = addDays(START, Math.floor(EVENTS / 80));
const ctx: XpContext = { isProduction: () => true };
const questCtx = { ...ctx, isTricky: () => false };

/** What Home and the always-mounted badge toast derive from the log after every answer. */
function home(log: readonly ProgressEvent[], projection: Projection) {
  return {
    xp: totalXp(log, ctx),
    streak: streakInfo(log, today, ctx),
    quests: questStatus(log, today, questCtx).map((q) => q.progress),
    map: mapState(packs, projection.state.cards, defeatedBosses(log)),
    league: league(log, today, ctx).rank,
    badges: achievementStats(log, { cards: projection.state.cards, units, today, xp: ctx }),
  };
}

function time<T>(f: () => T): { ms: number; value: T } {
  const start = performance.now();
  const value = f();
  return { ms: performance.now() - start, value };
}

describe('performance with a large log (20 000 events × 500 entries)', () => {
  it('appends an answer and re-derives Home in under 50 ms, with the same results as a full rescore', () => {
    const projection = new Projection(bigLog());
    home(projection.events, projection); // first render

    const answer = review(EVENTS + 1, today, `${today}T20:00:00.000Z`);
    const { ms, value } = time(() => {
      projection.add([answer]);
      return home(projection.events, projection);
    });
    expect(ms).toBeLessThan(50);

    // A context with its own scorer sees the log for the first time: a full rescore must agree.
    const fresh: XpContext = { isProduction: () => true };
    expect(scoreEvents(projection.events, fresh)).toEqual(scoreEvents(projection.events, ctx));
    expect(totalXp(projection.events, fresh)).toBe(value.xp);
  });

  it('renders Home from a cold start in under 50 ms once the log is scored', () => {
    const projection = new Projection(bigLog());
    totalXp(projection.events, ctx);
    const { ms } = time(() => home(projection.events, projection));
    expect(ms).toBeLessThan(50);
  });

  it('rescores fully when an older event arrives from another device', () => {
    const projection = new Projection(bigLog());
    const before = totalXp(projection.events, ctx);
    projection.add([review(EVENTS + 2, START, `${START}T07:00:00.000Z`)]);
    const fresh: XpContext = { isProduction: () => true };
    expect(totalXp(projection.events, ctx)).toBe(totalXp(projection.events, fresh));
    expect(totalXp(projection.events, ctx)).not.toBe(before);
  });
});
