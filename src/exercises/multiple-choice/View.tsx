import { useState } from 'react';
import { ChoiceList } from '../../components/ChoiceList';
import { shuffle } from '../../lib/session';
import { afterGap, GAP } from '../gap-fill';
import type { ViewProps } from '../types';
import type { MultipleChoiceData } from '.';

export function MultipleChoiceView({ data, ctx, locked, onAnswer }: ViewProps<MultipleChoiceData>) {
  const [options] = useState(() => shuffle(data.options, Math.random));
  const [started] = useState(() => performance.now());
  const [chosen, setChosen] = useState<string>();
  const [before, after] = data.sentence.split(GAP);
  const aid = ctx.helpLang === 'pl' ? data.pl : data.clue;

  function choose(option: string) {
    if (locked || chosen) return;
    setChosen(option);
    onAnswer({
      correct: option === data.answer,
      nearMiss: false,
      hintUsed: false,
      timeMs: performance.now() - started,
      given: option,
      expected: data.answer,
    });
  }

  return (
    <div className="choice-card">
      <p className="fr-sentence" lang="fr">
        {before}
        <span className={chosen ? 'gap filled' : 'gap'}>{chosen ?? '   '}</span>
        {afterGap(after ?? '', chosen ?? '')}
      </p>
      {aid && (
        <p className="sentence-aid" lang={ctx.helpLang}>
          {aid}
        </p>
      )}
      <ChoiceList options={options} answer={data.answer} chosen={chosen} locked={locked} lang="fr" onChoose={choose} />
    </div>
  );
}
