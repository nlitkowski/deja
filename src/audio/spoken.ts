import type { Audio } from '../content/audio';

/** Canonical form of a text: hashing it must not depend on markup, apostrophe style or spacing. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\*\*/g, '')
    .replace(/[’ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** Asides in parentheses (a verb to conjugate, `(fam.)`, a number in digits) are not read; `a / b` is read as a list. */
export const spoken = (text: string) =>
  normalizeText(text)
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/,? \/ /g, ', ')
    .trim();

/** What is read for a French text and its `audio` options; undefined when it is not recorded. */
export function audioTextOf(written: string, audio?: Audio): string | undefined {
  if (audio?.skip) return undefined;
  return spoken(audio?.text ?? written) || undefined;
}
