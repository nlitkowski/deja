import type { DayKey } from './date';
import { cardKey, isDue, type Skill, type SrsCard } from './srs';

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
  /** Which of the entry's cards the item trains. */
  skill: Skill;
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
  /** Which card an exercise type trains; omitted = every type is written. */
  skillOf?: (type: string) => Skill;
  /** Listening or speaking cards mixed into the session (review only), each up to its share. */
  otherSkills?: readonly OtherSkill[];
  rng?: () => number;
}

export interface OtherSkill {
  skill: Exclude<Skill, 'written'>;
  /** An entry becomes a candidate once it has a card of this skill (mastery ≥ 1): hear before you speak. */
  requires: Skill;
  newAllowed: number;
  /** Most of the session this skill may take. */
  share: number;
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

/** Spreads `others` evenly through `base`. */
export function interleave<T>(base: readonly T[], others: readonly T[]): T[] {
  const total = base.length + others.length;
  const out: T[] = [];
  let b = 0;
  let k = 0;
  for (let i = 0; i < total; i++) {
    const isOther = k < others.length && (b === base.length || i === Math.floor(((k + 0.5) * total) / others.length));
    out.push(isOther ? others[k++]! : base[b++]!);
  }
  return out;
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
    skillOf = () => 'written',
    otherSkills = [],
    rng = Math.random,
  } = input;
  const used = new Set<string>();

  /** Due cards of a skill first (oldest first), then new ones. */
  function candidates(skill: Skill, ready: (id: string) => boolean, allowedNew: number) {
    const card = (id: string) => srs[cardKey(id, skill)];
    // Recognition only revisits what the learner already produced correctly: never for new cards
    // or after a mistake, so choosing an answer never displaces typing it.
    const known = (id: string) => (card(id)?.reps ?? 0) > 0;
    const byEntry = indexExercisesByEntry(
      exercises.filter((ex) => skillOf(ex.type) === skill && (isProduction(ex.type) || ex.entryIds.every(known))),
    );
    const usable = entries.filter((e) => !e.deprecated && byEntry.has(e.id) && ready(e.id));
    const due = shuffle(
      usable.filter((e) => card(e.id) && isDue(card(e.id)!, today)),
      rng,
    ).sort((a, b) => card(a.id)!.due.localeCompare(card(b.id)!.due));
    const fresh = usable.filter((e) => !card(e.id)).slice(0, Math.max(0, allowedNew));
    const notDue = () =>
      usable
        .filter((e) => card(e.id) && !isDue(card(e.id)!, today))
        .sort((a, b) => card(a.id)!.due.localeCompare(card(b.id)!.due) || card(a.id)!.ease - card(b.id)!.ease);
    return { byEntry, chosen: [...due, ...fresh].map((e) => ({ id: e.id, early: false })), notDue };
  }

  function toItems(skill: Skill, byEntry: Map<string, SessionExercise[]>, chosen: readonly { id: string; early: boolean }[]): SessionItem[] {
    const items: SessionItem[] = [];
    for (const { id, early } of chosen) {
      const ex = pickExercise(byEntry.get(id)!, used, isProduction, recognitionShare, rng);
      if (!ex) continue;
      used.add(ex.id);
      items.push({ exerciseId: ex.id, entryId: id, skill, early, attempt: 1 });
    }
    return items;
  }

  const others = otherSkills.flatMap(({ skill, requires, newAllowed: allowedNew, share }) => {
    const { byEntry, chosen } = candidates(skill, (id) => !!srs[cardKey(id, requires)], allowedNew);
    return toItems(skill, byEntry, chosen.slice(0, Math.floor(maxItems * share)));
  });

  const written = candidates('written', () => true, newAllowed);
  const chosen = written.chosen.slice(0, Math.max(0, maxItems - others.length));
  if (mode === 'practice' && chosen.length < minPracticeItems) {
    chosen.push(...written.notDue().slice(0, minPracticeItems - chosen.length).map((e) => ({ id: e.id, early: true })));
  }
  return interleave(toItems('written', written.byEntry, chosen), others);
}

/** Puts a failed entry back a few cards later, with a different exercise when one exists. `candidates` must train the same skill. */
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
    skill: failed.skill,
    early: false,
    attempt: failed.attempt + 1,
  };
  const at = Math.min(position + 1 + SESSION.requeueGap, queue.length);
  return [...queue.slice(0, at), item, ...queue.slice(at)];
}
