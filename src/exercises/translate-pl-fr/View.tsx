import { TypingCard } from '../../components/TypingCard';
import { localize } from '../../content/localized';
import { ui } from '../../i18n/ui';
import type { ViewProps } from '../types';
import type { TranslateData } from '.';

export function TranslateView({ data, ctx, locked, onAnswer }: ViewProps<TranslateData>) {
  return (
    <TypingCard
      answers={data.answers}
      hint={localize(data.hint, ctx.helpLang)}
      ctx={ctx}
      locked={locked}
      onAnswer={onAnswer}
      prompt={() => (
        <>
          <p className="prompt-label">{ui.translateToFrench}</p>
          <p className="pl-prompt" lang="pl">
            {data.pl}
          </p>
        </>
      )}
    />
  );
}
