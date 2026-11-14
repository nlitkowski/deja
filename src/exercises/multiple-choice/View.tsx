import { useEffect, useState } from 'react';
import { ui } from '../../i18n/ui';
import { shuffle } from '../../lib/session';
import { GAP } from '../gap-fill';
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

  // Keys 1–4 pick an option, so a keyboard user never has to reach for the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const option = options[Number(e.key) - 1];
      if (option && !e.altKey && !e.ctrlKey && !e.metaKey) choose(option);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="choice-card">
      <p className="fr-sentence" lang="fr">
        {before}
        <span className={chosen ? 'gap filled' : 'gap'}>{chosen ?? '   '}</span>
        {after}
      </p>
      {aid && (
        <p className="sentence-aid" lang={ctx.helpLang}>
          {aid}
        </p>
      )}
      <div className="choices" role="group" aria-label={ui.chooseAnswer}>
        {options.map((option, i) => {
          const state = !chosen ? '' : option === data.answer ? ' right' : option === chosen ? ' wrong' : '';
          return (
            <button key={option} className={`choice${state}`} lang="fr" disabled={locked || !!chosen} onClick={() => choose(option)}>
              <span className="choice-key" aria-hidden>
                {i + 1}
              </span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
