import type { Picker, RetryPicker, SessionExercise } from '../lib/session';
import { GAME } from './config';

/** The lowest rung that allows this exercise; -1 when none does (a dictation too long, or not listening at all). */
export function rungOf(type: string, words = 0): number {
  return GAME.listeningLadder.findIndex((r) => r.types.includes(type) && (r.maxWords === undefined || words <= r.maxWords));
}

/** The rung a listening card stands on. */
export function stepOf(mastery: number): number {
  let step = 0;
  GAME.listeningLadder.forEach((r, i) => {
    if (mastery >= r.fromMastery) step = i;
  });
  return step;
}

const pickOne = <T>(items: readonly T[], rng: () => number) => items[Math.floor(rng() * items.length)];

/** Each type is as likely as the others, however many exercises it has (sentences far outnumber minimal pairs). */
function byType<E extends SessionExercise>(items: readonly E[], rng: () => number): E | undefined {
  const type = pickOne([...new Set(items.map((e) => e.type))], rng);
  return pickOne(items.filter((e) => e.type === type), rng);
}

/**
 * Draws an exercise on rung `top` or below, unused ones first. From `listeningTop.fromRung` up, the highest
 * type available comes most of the time; below it every type is as likely. Undefined when nothing fits.
 */
export function climb<E extends SessionExercise>(
  candidates: readonly E[],
  top: number,
  rung: (ex: E) => number,
  rng: () => number,
  used: ReadonlySet<string> = new Set(),
): E | undefined {
  const allowed = candidates.filter((ex) => {
    const r = rung(ex);
    return r >= 0 && r <= top;
  });
  const fresh = allowed.filter((ex) => !used.has(ex.id));
  const pool = fresh.length ? fresh : allowed;
  if (!pool.length) return undefined;
  const best = Math.max(...pool.map(rung));
  if (best < GAME.listeningTop.fromRung) return byType(pool, rng);
  const topType = pool.find((ex) => rung(ex) === best)!.type;
  const upper = pool.filter((ex) => ex.type === topType);
  const lower = pool.filter((ex) => ex.type !== topType);
  return byType(lower.length && rng() >= GAME.listeningTop.share ? lower : upper, rng);
}

/** Session picker for listening cards: what the card's mastery allows, nothing harder. */
export function ladderPicker(mastery: (entryId: string) => number, rung: (ex: SessionExercise) => number): Picker {
  return (candidates, entryId, used, rng) => climb(candidates, stepOf(mastery(entryId)), rung, rng, used);
}

/** After a mistake the retry comes from one rung lower (rung 0 stays on 0), or the nearest below it. */
export function ladderRetry(rung: (ex: SessionExercise) => number): RetryPicker {
  return (candidates, failed, rng) => {
    const failedEx = candidates.find((ex) => ex.id === failed.exerciseId);
    const top = Math.max(0, (failedEx ? rung(failedEx) : 0) - 1);
    const others = candidates.filter((ex) => ex.id !== failed.exerciseId);
    const onRung = others.filter((ex) => rung(ex) === top);
    return climb(onRung, top, rung, rng) ?? climb(others, top, rung, rng);
  };
}
