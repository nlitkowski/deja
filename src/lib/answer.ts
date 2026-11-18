export type AccentPairs = ReadonlyArray<readonly [string, string]>;

/** Why an answer was graded the way it was, beyond right or wrong. */
export type AnswerNote = 'ne-dropped' | 'hyphen';

export interface AnswerCheck {
  correct: boolean;
  nearMiss: boolean;
  expected: string;
  note?: AnswerNote;
}

export interface CheckOptions {
  /** Spoken French drops the "ne" of a negation; dictations want what was heard, so they turn this off. */
  colloquial?: boolean;
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

const UNITS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const TENS: Record<number, string[]> = { 20: ['vingt'], 30: ['trente'], 40: ['quarante'], 50: ['cinquante'], 60: ['soixante'], 70: ['septante'], 80: ['huitante', 'octante'], 90: ['nonante'] };

/** Every spelling of 0–100, hyphens written as spaces (France, Belgium and Switzerland). */
function numberSpellings(): Map<string, number> {
  const out = new Map<string, number>();
  const add = (n: number, ...spellings: string[]) => spellings.forEach((s) => out.set(s, n));
  const below20 = (n: number) => (n <= 16 ? [UNITS[n]!] : [`dix ${UNITS[n - 10]}`]);
  for (let n = 0; n < 20; n++) add(n, ...below20(n));
  for (let n = 20; n < 100; n++) {
    const ten = Math.floor(n / 10) * 10;
    const unit = n % 10;
    const regional = TENS[ten]!.flatMap((t) => (unit === 0 ? [t] : unit === 1 ? [`${t} et un`, `${t} un`] : [`${t} ${UNITS[unit]}`]));
    if (ten <= 60) add(n, ...regional);
    else if (ten === 70 || ten === 90) {
      const base = ten === 70 ? 'soixante' : 'quatre vingt';
      const rest = n - ten + 10;
      const french = rest === 11 && ten === 70 ? ['soixante et onze', 'soixante onze'] : below20(rest).map((r) => `${base} ${r}`);
      add(n, ...regional, ...french);
    } else add(n, ...regional, ...(unit === 0 ? ['quatre vingts', 'quatre vingt'] : [`quatre vingt ${UNITS[unit]}`]));
  }
  add(100, 'cent');
  // "un" and "une" alone are articles far more often than numbers.
  out.delete('un');
  return out;
}

const NUMBERS = numberSpellings();
const LETTER = '[\\p{L}\\d]';
const NUMBER_WORDS = new RegExp(
  `(?<!${LETTER})(${[...NUMBERS.keys()]
    .sort((a, b) => b.length - a.length)
    .map((s) => s.replace(/ /g, '[ -]'))
    .join('|')})(?!${LETTER})`,
  'gu',
);
const HOURS = new RegExp(`(\\d{1,2}) ?(?:h|heures?)(?: (?:et )?(demie|quart|\\d{1,2}))?(?!${LETTER})`, 'gu');

/**
 * What two answers must share to count as the same: punctuation inside is ignored, numbers 0–100 may be
 * written in words or digits, and times as "8 h 30", "8h30" or "huit heures et demie".
 */
function canonical(normalized: string): string {
  return normalized
    .replace(/(\d{1,2}):(\d{2})/g, '$1h$2')
    .replace(/[,;:]/g, ' ')
    .replace(/(?<![\p{L}\d])une heure(?![\p{L}\d])/gu, '1 heure')
    .replace(NUMBER_WORDS, (w) => String(NUMBERS.get(w.replace(/-/g, ' '))))
    .replace(HOURS, (_, h: string, m?: string) => {
      const minutes = m === 'demie' ? '30' : m === 'quart' ? '15' : m?.padStart(2, '0');
      return `${Number(h)}h${minutes ?? ''}`;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

const ELISION = /(?<![\p{L}])(je|ce|me|te|se|le|la) (?=[aeiouyhàâéèêëîïôûœ])/gu;

/** The expected answer as it is said without "ne": "je n'ai pas" → "j'ai pas", "il n'y a personne" → "il y a personne" / "y a personne". */
function withoutNe(expected: string): string[] {
  if (!/(?<!\p{L})(ne |n')/u.test(expected) || !/(?<!\p{L})(pas|plus|jamais|rien|personne)(?!\p{L})/u.test(expected)) return [];
  const dropped = expected
    .replace(/(?<!\p{L})ne (?=\S)/gu, '')
    .replace(/(?<!\p{L})n'/gu, '')
    .replace(ELISION, (_, w: string) => `${w[0]}'`);
  return /(?<!\p{L})il y a(?!\p{L})/u.test(dropped) ? [dropped, dropped.replace(/(?<!\p{L})il y a(?!\p{L})/u, 'y a')] : [dropped];
}

const tokens = (s: string) => s.split(/[\s']+/).filter(Boolean);
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

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

export function checkAnswer(
  input: string,
  answers: readonly string[],
  pairs: AccentPairs | Set<string> = [],
  { colloquial = true }: CheckOptions = {},
): AnswerCheck {
  const expected = answers[0] ?? '';
  const given = canonical(normalize(input));
  if (!given) return { correct: false, nearMiss: false, expected };

  const normalized = answers.map((a) => canonical(normalize(a)));
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

  if (colloquial) {
    const spoken = normalized.findIndex((a) => withoutNe(a).includes(given));
    if (spoken >= 0) return { correct: true, nearMiss: false, expected: answers[spoken]!, note: 'ne-dropped' };
  }

  if (given.includes('parce-qu')) {
    const unhyphenated = given.replace(/parce-qu/g, 'parce qu');
    const i = normalized.indexOf(unhyphenated);
    if (i >= 0) return { correct: false, nearMiss: false, expected: answers[i]!, note: 'hyphen' };
  }
  return { correct: false, nearMiss: false, expected };
}
