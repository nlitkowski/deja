import { z } from 'zod';

/** Language of the learning aids: meanings, tips, hints, sentence clues. */
export type HelpLang = 'pl' | 'fr';
export const HELP_LANGS: readonly HelpLang[] = ['pl', 'fr'];

/** Help text; `fr` is optional and falls back to `pl`. */
export const LocalizedSchema = z.object({ pl: z.string().min(1), fr: z.string().min(1).optional() });
export type Localized = z.infer<typeof LocalizedSchema>;

export function localize(text: Localized | undefined, lang: HelpLang): string | undefined {
  return text && (text[lang] ?? text.pl);
}
