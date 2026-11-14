import type { DayKey } from './date';
import { cardKey, isDue, type SrsCard } from './srs';

export interface SessionEntry {
  id: string;
  deprecated?: boolean;
}

export interface SessionExercise {
  id: string;
  type: string;
  entryIds: string[];
}

export interface SessionItem {
  exerciseId: string;
  entryId: string;
  /** Reviewed before it was due: a correct answer does not move the SRS schedule. */
  early: boolean;
  attempt: number;
}

export interface BuildSessionInput {
  /** In content order; new entries are introduced in this order. */
  entries: SessionEntry[];
  exercises: SessionExercise[];
  srs: Record<string, SrsCard>;
  today: DayKey;
  newAllowed: number;
  isProduction: (type: string) => boolean;
  /** `practice` tops the session up with not-yet-due entries when there is too little to review. */
  mode: 'review' | 'practice';
  maxItems?: number;
  minPracticeItems?: number;
  /** Share of recognition (non-production) exercises when both kinds exist. */
  recognitionShare?: number;
  rng?: () => number;
}

export const SESSION = {
  maxItems: 18,
  minPracticeItems: 10,
  recognitionShare: 0.2,
  requeueGap: 3,
  maxAttempts: 3,
} as const;

export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function indexExercisesByEntry<E extends SessionExercise>(exercises: readonly E[]): Map<string, E[]> {
  const map = new Map<string, E[]>();
  for (const ex of exercises) {
    for (const id of ex.entryIds) {
      const list = map.get(id);
      if (list) list.push(ex);
      else map.set(id, [ex]);
    }
  }
  return map;
}

export function pickExercise(
  candidates: readonly SessionExercise[],
  used: ReadonlySet<string>,
  isProduction: (type: string) => boolean,
  recognitionShare: number,
  rng: () => number,
): SessionExercise | undefined {
  const fresh = candidates.filter((ex) => !used.has(ex.id));
  const pool = fresh.length ? fresh : candidates;
  const production = pool.filter((ex) => isProduction(ex.type));
  const recognition = pool.filter((ex) => !isProduction(ex.type));
  const useRecognition = recognition.length > 0 && (production.length === 0 || rng() < recognitionShare);
  const from = useRecognition ? recognition : production;
  return from[Math.floor(rng() * from.length)];
}

export function buildSession(input: BuildSessionInput): SessionItem[] {
  const {
    entries,
    exercises,
    srs,
    today,
    newAllowed,
    isProduction,
    mode,
    maxItems = SESSION.maxItems,
    minPracticeItems = SESSION.minPracticeItems,
    recognitionShare = SESSION.recognitionShare,
    rng = Math.random,
  } = input;

  // Recognition only revisits what the learner already produced correctly: never for new entries
  // or after a mistake, so choosing an answer never displaces typing it.
  const known = (id: string) => (srs[cardKey(id)]?.reps ?? 0) > 0;
  const byEntry = indexExercisesByEntry(exercises.filter((ex) => isProduction(ex.type) || ex.entryIds.every(known)));
  const usable = entries.filter((e) => !e.deprecated && byEntry.has(e.id));

  const due = shuffle(
    usable.filter((e) => srs[cardKey(e.id)] && isDue(srs[cardKey(e.id)]!, today)),
    rng,
  ).sort((a, b) => srs[a.id]!.due.localeCompare(srs[b.id]!.due));
  const fresh = usable.filter((e) => !srs[cardKey(e.id)]).slice(0, Math.max(0, newAllowed));

  const chosen: { id: string; early: boolean }[] = [
    ...due.map((e) => ({ id: e.id, early: false })),
    ...fresh.map((e) => ({ id: e.id, early: false })),
  ].slice(0, maxItems);

  if (mode === 'practice' && chosen.length < minPracticeItems) {
    const extra = usable
      .filter((e) => srs[cardKey(e.id)] && !isDue(srs[cardKey(e.id)]!, today))
      .sort((a, b) => srs[a.id]!.due.localeCompare(srs[b.id]!.due) || srs[a.id]!.ease - srs[b.id]!.ease)
      .slice(0, minPracticeItems - chosen.length);
    chosen.push(...extra.map((e) => ({ id: e.id, early: true })));
  }

  const used = new Set<string>();
  const items: SessionItem[] = [];
  for (const { id, early } of chosen) {
    const ex = pickExercise(byEntry.get(id)!, used, isProduction, recognitionShare, rng);
    if (!ex) continue;
    used.add(ex.id);
    items.push({ exerciseId: ex.id, entryId: id, early, attempt: 1 });
  }
  return items;
}

/** Puts a failed entry back a few cards later, with a different exercise when one exists. */
export function requeue(
  queue: readonly SessionItem[],
  position: number,
  failed: SessionItem,
  candidates: readonly SessionExercise[],
  isProduction: (type: string) => boolean,
  rng: () => number = Math.random,
): SessionItem[] {
  if (failed.attempt >= SESSION.maxAttempts) return [...queue];
  const ex = pickExercise(candidates, new Set([failed.exerciseId]), isProduction, 0, rng);
  const item: SessionItem = {
    exerciseId: ex?.id ?? failed.exerciseId,
    entryId: failed.entryId,
    early: false,
    attempt: failed.attempt + 1,
  };
  const at = Math.min(position + 1 + SESSION.requeueGap, queue.length);
  return [...queue.slice(0, at), item, ...queue.slice(at)];
}
