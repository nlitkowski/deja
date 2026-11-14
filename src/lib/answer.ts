export type AccentPairs = ReadonlyArray<readonly [string, string]>;

export interface AnswerCheck {
  correct: boolean;
  nearMiss: boolean;
  expected: string;
}

const APOSTROPHES = /[’‘ʼ`´]/g;
const NBSP = /[\u00a0\u202f]/g;
const TRAILING_PUNCT = /\s*[.!?…]+$/u;

export function normalize(input: string): string {
  return input
    .normalize('NFC')
    .replace(APOSTROPHES, "'")
    .replace(NBSP, ' ')
    .toLowerCase()
    // Phone keyboards rarely offer the ligatures; "oeuf" and "œuf" are the same answer.
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/\s+/g, ' ')
    .replace(/'\s+/g, "'")
    .trim()
    .replace(TRAILING_PUNCT, '')
    .trim();
}

export function stripAccents(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}

const tokens = (s: string) => s.split(/[\s']+/).filter(Boolean);
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function buildPairSet(pairs: AccentPairs): Set<string> {
  return new Set(pairs.map(([a, b]) => pairKey(normalize(a), normalize(b))));
}

/** True when an accent difference turns the answer into a different valid word (ou → où). */
function accentChangesWord(given: string, expected: string, pairSet: Set<string>): boolean {
  const g = tokens(given);
  const e = tokens(expected);
  if (g.length !== e.length) return false;
  return g.some((tok, i) => tok !== e[i] && pairSet.has(pairKey(tok, e[i]!)));
}

export function checkAnswer(input: string, answers: readonly string[], pairs: AccentPairs | Set<string> = []): AnswerCheck {
  const expected = answers[0] ?? '';
  const given = normalize(input);
  if (!given) return { correct: false, nearMiss: false, expected };

  const normalized = answers.map(normalize);
  const exact = normalized.indexOf(given);
  if (exact >= 0) return { correct: true, nearMiss: false, expected: answers[exact]! };

  const pairSet = pairs instanceof Set ? pairs : buildPairSet(pairs);
  const bare = stripAccents(given);
  for (let i = 0; i < normalized.length; i++) {
    const candidate = normalized[i]!;
    if (stripAccents(candidate) === bare && !accentChangesWord(given, candidate, pairSet)) {
      return { correct: true, nearMiss: true, expected: answers[i]! };
    }
  }
  return { correct: false, nearMiss: false, expected };
}
