import { normalize } from '../../lib/answer';

/** Written differently, said the same. Accent-only pairs (ou / où, a / à) need no entry: accents are folded below. */
const HOMOPHONES = [
  ['et', 'est', 'es'],
  ['ces', 'ses', "c'est", "s'est", 'sais', 'sait'],
  ['ce', 'se'],
  ['son', 'sont'],
  ['on', 'ont'],
  ['mes', 'mais', 'met', 'mets', 'mai'],
  ['ma', "m'a"],
  ['ta', "t'a"],
  ['la', "l'a"],
  ['il', 'ils'],
  ['elle', 'elles'],
  ['leur', 'leurs'],
  ['peu', 'peux', 'peut'],
  ['au', 'aux', 'eau', 'haut', 'oh'],
  ['vers', 'vert', 'verre', 'verres'],
  ['cent', 'sans', 'sang'],
  ['mer', 'mere', 'maire'],
  ['quand', 'quant', "qu'en"],
  ['tout', 'tous', 'toux'],
  ['pres', 'pret'],
  ['vin', 'vingt', 'vain'],
  ['faim', 'fin'],
  ['fois', 'foi', 'foie'],
  ['voix', 'voie', 'vois', 'voit'],
];

const groupOf = new Map(HOMOPHONES.flatMap((group, i) => group.map((w) => [w, i] as const)));

/** Folds what spelling adds and speech drops: most accents (é stays: mange ≠ mangé) and silent endings of longer words. */
function sound(word: string): string {
  const w = word
    .normalize('NFD')
    .replace(/é/g, '§')
    .replace(/\p{M}/gu, '')
    .replace(/§/g, 'é');
  if (groupOf.has(w)) return `#${groupOf.get(w)}`;
  if (w.length <= 3) return w;
  return w
    .replace(/(er|ez|ées|ée|és)$/, 'é')
    .replace(/(ent|es|s|x|t|d)$/, '')
    .replace(/e$/, '');
}

const words = (text: string) => normalize(text).replace(/[.,;:!?…«»"]/g, ' ').split(/\s+/).filter(Boolean);

/**
 * True when two texts would sound alike, so hearing one cannot tell which was meant. A heuristic guard
 * against homophone pairs in content, not phonetics: different word counts always count as different.
 */
export function soundsAlike(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  return wa.length === wb.length && wa.every((w, i) => sound(w) === sound(wb[i]!));
}
