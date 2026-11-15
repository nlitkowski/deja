import { normalize, pairKey, stripAccents } from './answer';

/**
 * `ok` and `accent` count as written; `accent` is a near miss unless it turns the word into another
 * one (ou → où), which is `wrong`. `missing` words were not typed, `extra` ones were never said.
 * `wrong`, `missing` and `extra` are mistakes.
 */
export type DiffKind = 'ok' | 'accent' | 'wrong' | 'missing' | 'extra';

export interface DiffPart {
  kind: DiffKind;
  expected?: string;
  given?: string;
}

export interface DictationCheck {
  correct: boolean;
  nearMiss: boolean;
  parts: DiffPart[];
}

// Case and punctuation never decide a dictation: phone keyboards make both a chore.
const PUNCT = /[.,;:!?…«»"()/]/g;

interface Word {
  raw: string;
  key: string;
  loose: string;
}

// A hyphen splits like a space (dix-sept = dix sept); the half before it keeps the hyphen for display.
function words(text: string): Word[] {
  return text
    .normalize('NFC')
    .replace(PUNCT, ' ')
    .split(/\s+/)
    .flatMap((w) => w.split(/(?<=-)/))
    .map((raw) => ({ raw, key: normalize(raw.replace(/-+$/, '')) }))
    .filter((w) => w.key)
    .map((w) => ({ ...w, loose: stripAccents(w.key) }));
}

const MISTAKES: ReadonlySet<DiffKind> = new Set(['wrong', 'missing', 'extra']);

/**
 * Word-by-word comparison of a typed dictation with the sentence that was read. A mistake in a `key` word
 * (the trained entry) fails it; one mistake elsewhere is a near miss, two fail.
 */

export function checkDictation(given: string, expected: string, pairSet: ReadonlySet<string> = new Set(), key = ''): DictationCheck {
  const keyWords = new Set(words(key).map((w) => w.loose));
  const e = words(expected);
  const g = words(given);

  // Longest common subsequence on accent-free words: what was heard right, in order.
  const lcs = Array.from({ length: e.length + 1 }, () => new Array<number>(g.length + 1).fill(0));
  for (let i = e.length - 1; i >= 0; i--) {
    for (let j = g.length - 1; j >= 0; j--) {
      lcs[i]![j] = e[i]!.loose === g[j]!.loose ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const parts: DiffPart[] = [];
  let missing: Word[] = [];
  let extra: Word[] = [];
  // Between two matches, a dropped word and a typed one stand for one misheard word.
  const flush = () => {
    const paired = Math.min(missing.length, extra.length);
    for (let k = 0; k < paired; k++) parts.push({ kind: 'wrong', expected: missing[k]!.raw, given: extra[k]!.raw });
    for (const w of missing.slice(paired)) parts.push({ kind: 'missing', expected: w.raw });
    for (const w of extra.slice(paired)) parts.push({ kind: 'extra', given: w.raw });
    missing = [];
    extra = [];
  };

  let i = 0;
  let j = 0;
  while (i < e.length || j < g.length) {
    if (i < e.length && j < g.length && e[i]!.loose === g[j]!.loose) {
      flush();
      const exp = e[i]!;
      const got = g[j]!;
      const kind = exp.key === got.key ? 'ok' : pairSet.has(pairKey(exp.key, got.key)) ? 'wrong' : 'accent';
      parts.push({ kind, expected: exp.raw, given: got.raw });
      i++;
      j++;
    } else if (j < g.length && (i === e.length || lcs[i]![j + 1]! >= lcs[i + 1]![j]!)) {
      extra.push(g[j++]!);
    } else {
      missing.push(e[i++]!);
    }
  }
  flush();

  const mistakes = parts.filter((p) => MISTAKES.has(p.kind));
  const inKey = mistakes.some((p) => p.expected !== undefined && keyWords.has(stripAccents(normalize(p.expected.replace(/-+$/, '')))));
  const correct = parts.some((p) => !MISTAKES.has(p.kind)) && !inKey && mistakes.length <= 1;
  return { correct, nearMiss: correct && (mistakes.length > 0 || parts.some((p) => p.kind === 'accent')), parts };
}
