import type { ExerciseTypeInfo } from '../content/loader';
import type { HelpLang } from '../content/localized';
import { confusableDuel } from './confusable-duel';
import { DuelView } from './confusable-duel/View';
import { gapFill } from './gap-fill';
import { GapFillView } from './gap-fill/View';
import { matchPairs } from './match-pairs';
import { MatchPairsView } from './match-pairs/View';
import { multipleChoice } from './multiple-choice';
import { MultipleChoiceView } from './multiple-choice/View';
import { translatePlFr } from './translate-pl-fr';
import { TranslateView } from './translate-pl-fr/View';
import type { ExerciseType } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry; data is validated by each type's schema
const types: ExerciseType<any>[] = [
  { ...gapFill, View: GapFillView },
  { ...translatePlFr, View: TranslateView },
  { ...multipleChoice, View: MultipleChoiceView },
  { ...confusableDuel, View: DuelView },
  { ...matchPairs, View: MatchPairsView },
];

export const exerciseTypes: ReadonlyMap<string, ExerciseType<unknown>> = new Map(types.map((t) => [t.id, t]));

export const exerciseTypeInfo: Record<string, ExerciseTypeInfo> = Object.fromEntries(
  types.map((t) => [t.id, { schema: t.schema, production: t.production, generate: t.generate }]),
);

export const isProduction = (type: string) => exerciseTypes.get(type)?.production ?? false;

export function supportsHelpLang(type: string, lang: HelpLang): boolean {
  const langs = exerciseTypes.get(type)?.helpLangs;
  return !langs || langs.includes(lang);
}
