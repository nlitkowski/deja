import type { Audio } from '../content/audio';
import { GAP, type GapFillData } from './gap-fill';
import type { GenCtx } from './types';

/** A hand-written gap-fill sentence for one entry: the raw material of generated recognition exercises. */
export interface GapSentence {
  exerciseId: string;
  entryId: string;
  sentence: string;
  answers: string[];
  pl?: string;
  clue?: string;
  audio?: Audio;
}

export function gapSentences(entryId: string, ctx: GenCtx): GapSentence[] {
  return ctx
    .exercisesOf(entryId)
    .filter((ex) => ex.type === 'gap-fill' && ex.entryIds.length === 1)
    .map((ex) => {
      const { sentence, answers, pl, clue } = ex.data as GapFillData;
      return { exerciseId: ex.id, entryId, sentence, answers, pl, clue, audio: ex.audio };
    });
}

const startsWithGap = (sentence: string) => sentence.trimStart().startsWith(GAP);

/** How the entry is written in a gap (from its first sentence), in lower case: the label of a choice. */
export function labelOf(entryId: string, ctx: GenCtx): string | undefined {
  const first = gapSentences(entryId, ctx)[0];
  if (!first) return undefined;
  const answer = first.answers[0]!;
  return startsWithGap(first.sentence) ? answer.charAt(0).toLocaleLowerCase('fr') + answer.slice(1) : answer;
}

/** A choice shown in a sentence-initial gap starts with a capital, like the expected answer. */
export function inSentence(label: string, sentence: string): string {
  return startsWithGap(sentence) ? label.charAt(0).toLocaleUpperCase('fr') + label.slice(1) : label;
}

const normalize = (s: string) => s.trim().toLocaleLowerCase('fr').replace(/’/g, "'");

export const sameWord = (a: string, b: string) => normalize(a) === normalize(b);
