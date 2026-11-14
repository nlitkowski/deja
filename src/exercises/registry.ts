import type { ExerciseTypeInfo } from '../content/loader';
import type { HelpLang } from '../content/localized';
import { gapFill } from './gap-fill';
import { GapFillView } from './gap-fill/View';
import { translatePlFr } from './translate-pl-fr';
import { TranslateView } from './translate-pl-fr/View';
import type { ExerciseType } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry; data is validated by each type's schema
const types: ExerciseType<any>[] = [
  { ...gapFill, View: GapFillView },
  { ...translatePlFr, View: TranslateView },
];

export const exerciseTypes: ReadonlyMap<string, ExerciseType<unknown>> = new Map(types.map((t) => [t.id, t]));

export const exerciseTypeInfo: Record<string, ExerciseTypeInfo> = Object.fromEntries(
  types.map((t) => [t.id, { schema: t.schema, production: t.production }]),
);

export const isProduction = (type: string) => exerciseTypes.get(type)?.production ?? false;

export function supportsHelpLang(type: string, lang: HelpLang): boolean {
  const langs = exerciseTypes.get(type)?.helpLangs;
  return !langs || langs.includes(lang);
}
