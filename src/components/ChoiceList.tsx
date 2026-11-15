import { useEffect, type ReactNode } from 'react';
import { ui } from '../i18n/ui';

interface Props {
  options: readonly string[];
  answer: string;
  chosen?: string;
  locked: boolean;
  lang: string;
  onChoose: (option: string) => void;
  /** Shown after an option once the answer is in (e.g. a button to hear it). */
  after?: (option: string) => ReactNode;
}

/** Buttons for a recognition answer; keys 1–4 pick an option. */
export function ChoiceList({ options, answer, chosen, locked, lang, onChoose, after }: Props) {
  const done = locked || chosen !== undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const option = options[Number(e.key) - 1];
      if (option && !done && !e.altKey && !e.ctrlKey && !e.metaKey) onChoose(option);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="choices" role="group" aria-label={ui.chooseAnswer}>
      {options.map((option, i) => {
        const state = !chosen ? '' : option === answer ? ' right' : option === chosen ? ' wrong' : '';
        const button = (
          <button key={option} className={`choice${state}`} lang={lang} disabled={done} onClick={() => onChoose(option)}>
            <span className="choice-key" aria-hidden>
              {i + 1}
            </span>
            {option}
          </button>
        );
        if (!after) return button;
        return (
          <div key={option} className="choice-row">
            {button}
            {done && after(option)}
          </div>
        );
      })}
    </div>
  );
}
