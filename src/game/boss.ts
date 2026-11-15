import { inSentence, sameWord, type GapSentence } from '../exercises/gapSentences';
import { shuffle } from '../lib/session';

export interface BossGroup {
  entryIds: string[];
  /** How each entry is written in a gap: the choices of a question about the group. */
  labels: Readonly<Record<string, string>>;
  sentences: Readonly<Record<string, readonly GapSentence[]>>;
}

export interface BossQuestion {
  /** `choice`: pick among the group's entries; `typed`: write the answer. */
  kind: 'choice' | 'typed';
  exerciseId: string;
  entryId: string;
  sentence: string;
  answers: string[];
  options?: string[];
  pl?: string;
  clue?: string;
}

/** Without a configured boss: each entry with its confusables from the unit (up to 3), the rest alone. */
export function autoBossGroups(entries: readonly { id: string; confusables: readonly string[] }[]): string[][] {
  const ids = new Set(entries.map((e) => e.id));
  const groups: string[][] = [];
  for (const entry of entries) {
    const group = [entry.id, ...entry.confusables.filter((c) => ids.has(c))].slice(0, 3);
    if (groups.some((g) => group.every((id) => g.includes(id)))) continue;
    groups.push(group);
  }
  return groups;
}

/**
 * Questions taken in turn from each group and each entry in it, half of them (by `rng`) as a choice
 * between the group's entries when it has two or more, the rest typed.
 */
export function buildBossQuestions(groups: readonly BossGroup[], count: number, rng: () => number): BossQuestion[] {
  const decks = groups.map((g) => ({
    group: g,
    entries: g.entryIds.filter((id) => g.sentences[id]?.length),
    turn: 0,
    queues: new Map(g.entryIds.map((id) => [id, shuffle(g.sentences[id] ?? [], rng)])),
  }));
  // An entry can sit in two groups: a sentence comes back only once the entry has none left unasked.
  const asked = new Map<string, number>();
  const playable = decks.filter((d) => d.entries.length);
  if (!playable.length) return [];

  const questions: BossQuestion[] = [];
  for (let i = 0; questions.length < count; i++) {
    const deck = playable[i % playable.length]!;
    const entryId = deck.entries[deck.turn++ % deck.entries.length]!;
    const queue = deck.queues.get(entryId)!;
    const s = queue.reduce((best, c) => ((asked.get(c.exerciseId) ?? 0) < (asked.get(best.exerciseId) ?? 0) ? c : best));
    asked.set(s.exerciseId, (asked.get(s.exerciseId) ?? 0) + 1);

    const others = deck.group.entryIds
      .filter((id) => id !== entryId && deck.group.labels[id])
      .map((id) => inSentence(deck.group.labels[id]!, s.sentence))
      .filter((o) => !s.answers.some((a) => sameWord(a, o)));
    const choice = others.length > 0 && rng() < 0.5;
    questions.push({
      kind: choice ? 'choice' : 'typed',
      exerciseId: s.exerciseId,
      entryId,
      sentence: s.sentence,
      answers: s.answers,
      options: choice ? [s.answers[0]!, ...new Set(others)] : undefined,
      pl: s.pl,
      clue: s.clue,
    });
  }
  return questions;
}

/** A listening boss question: an exercise shown with its own view. */
export interface ListeningQuestion {
  exerciseId: string;
  entryIds: string[];
  type: string;
  data: unknown;
}

/** Minimal pairs and gap dictations in turn, each deck shuffled and dealt again once used up. */
export function buildListeningBossQuestions(
  decks: readonly (readonly ListeningQuestion[])[],
  count: number,
  rng: () => number,
): ListeningQuestion[] {
  const playable = decks.filter((d) => d.length);
  if (!playable.length) return [];
  const piles = playable.map(() => [] as ListeningQuestion[]);
  const questions: ListeningQuestion[] = [];
  for (let i = 0; questions.length < count; i++) {
    const d = i % playable.length;
    if (!piles[d]!.length) piles[d] = shuffle(playable[d]!, rng);
    questions.push(piles[d]!.pop()!);
  }
  return questions;
}

export interface BossRun {
  /** Index of the question being asked. */
  index: number;
  lives: number;
  correct: number;
  mistakes: number;
  /** Set once the run is over. */
  defeated?: boolean;
}

export const startBoss = (lives: number): BossRun => ({ index: 0, lives, correct: 0, mistakes: 0 });

/** One answer: a mistake costs a life; no lives left loses, the last question answered with lives left wins. */
export function bossAnswer(run: BossRun, correct: boolean, questions: number): BossRun {
  const lives = correct ? run.lives : run.lives - 1;
  const next = { index: run.index + 1, lives, correct: run.correct + (correct ? 1 : 0), mistakes: run.mistakes + (correct ? 0 : 1) };
  if (lives <= 0) return { ...next, defeated: false };
  if (next.index >= questions) return { ...next, defeated: true };
  return next;
}
