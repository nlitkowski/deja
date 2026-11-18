import { audioTextOf } from '../audio/spoken';
import type { Audio } from '../content/audio';
import type { Entry } from '../content/schema';
import { fillGap } from './gap-fill';
import { gapSentences } from './gapSentences';
import type { GenCtx } from './types';

/** A recorded French sentence of an entry, the raw material of generated listening exercises. */
export interface Heard {
  /** As recorded: the text to play and, for a dictation, to type. */
  text: string;
  pl?: string;
  /** Present when it comes from a gap-fill. */
  gap?: { sentence: string; answer: string };
}

/**
 * Only sentences heard exactly as written: not skipped, not read differently (`audio.text`: digits read
 * as words) and not ambiguous by ear (`audio.dictation: false`).
 */
const usable = (audio?: Audio) => !audio?.skip && !audio?.text && audio?.dictation !== false;

export function heardSentences(entry: Entry, ctx: GenCtx): Heard[] {
  if (entry.deprecated) return [];
  const out = new Map<string, Heard>();
  for (const s of gapSentences(entry.id, ctx)) {
    const answer = s.answers[0]!;
    const text = usable(s.audio) && audioTextOf(fillGap(s.sentence, answer));
    if (text && !out.has(text)) out.set(text, { text, pl: s.pl, gap: { sentence: s.sentence, answer } });
  }
  for (const ex of entry.examples) {
    const text = usable(ex.audio) && audioTextOf(ex.fr);
    if (text && !out.has(text)) out.set(text, { text, pl: ex.pl });
  }
  return [...out.values()];
}

/** Stable pseudo-random order: generated exercises must come out the same on every load. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}
