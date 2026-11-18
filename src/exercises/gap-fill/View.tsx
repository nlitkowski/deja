import { TypingCard } from '../../components/TypingCard';
import { localize } from '../../content/localized';
import type { ViewProps } from '../types';
import { afterGap, GAP, type GapFillData } from '.';

export function GapFillView({ data, ctx, locked, onAnswer }: ViewProps<GapFillData>) {
  const [before, after] = data.sentence.split(GAP);
  const aid = ctx.helpLang === 'pl' ? data.pl : data.clue;
  return (
    <TypingCard
      answers={data.answers}
      hint={localize(data.hint, ctx.helpLang)}
      ctx={ctx}
      locked={locked}
      onAnswer={onAnswer}
      prompt={(value) => (
        <>
          <p className="fr-sentence" lang="fr">
            {before}
            <span className={value ? 'gap filled' : 'gap'}>{value || '   '}</span>
            {afterGap(after ?? '', value)}
          </p>
          {aid && (
            <p className="sentence-aid" lang={ctx.helpLang}>
              {aid}
            </p>
          )}
        </>
      )}
    />
  );
}
