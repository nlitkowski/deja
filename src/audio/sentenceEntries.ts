import type { Entry, Exercise } from '../content/schema';
import { audioTextOf } from './spoken';
import { exerciseAudioText } from './texts';

/**
 * For every recorded sentence, the entries whose exercises or examples contain it. A sentence written for
 * one entry often reappears in another's (a duel, a gap on a different word): that is how a dictation
 * learns which other entries it asks for, without reading the text.
 */
export function sentenceEntries(exercises: Iterable<Pick<Exercise, 'type' | 'data' | 'audio' | 'entryIds'>>, entries: Iterable<Entry>): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  const add = (text: string | undefined, ids: readonly string[]) => {
    if (!text) return;
    const set = index.get(text) ?? new Set<string>();
    ids.forEach((id) => set.add(id));
    index.set(text, set);
  };
  for (const ex of exercises) add(exerciseAudioText(ex), ex.entryIds);
  for (const entry of entries) for (const ex of entry.examples) add(audioTextOf(ex.fr, ex.audio), [entry.id]);
  return index;
}

/** Every entry the sentence belongs to has been seen in writing, or is the one being trained. */
export function knownSentence(text: string, own: readonly string[], index: ReadonlyMap<string, ReadonlySet<string>>, seen: (entryId: string) => boolean): boolean {
  return [...(index.get(text) ?? [])].every((id) => own.includes(id) || seen(id));
}
