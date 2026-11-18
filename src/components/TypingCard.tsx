import { useEffect, useRef, useState, type ReactNode } from 'react';
import { checkAnswer, type AnswerCheck } from '../lib/answer';
import type { AnswerResult, ExerciseContext } from '../exercises/types';
import { ui } from '../i18n/ui';
import { AccentBar } from './AccentBar';
import { Icon } from './Icon';

interface Props {
  answers: string[];
  hint?: string;
  ctx: ExerciseContext;
  locked: boolean;
  onAnswer: (r: AnswerResult) => void;
  /** Replaces the usual comparison with `answers` (a dictation compares word by word). */
  check?: (given: string) => AnswerCheck;
  /** Grade what was written, not how it is said: dictations do not accept a dropped "ne". */
  literal?: boolean;
  /** Renders the prompt; receives the current input so a gap can show it inline. */
  prompt: (value: string) => ReactNode;
}

export function TypingCard({ answers, hint, ctx, locked, onAnswer, check: customCheck, literal, prompt }: Props) {
  const [value, setValue] = useState('');
  const [hintShown, setHintShown] = useState(false);
  const started = useState(() => performance.now())[0];
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!locked) input.current?.focus();
  }, [locked]);

  function submit(given: string) {
    if (locked) return;
    const check = customCheck ? customCheck(given) : checkAnswer(given, answers, ctx.accentPairs, { colloquial: !literal });
    onAnswer({
      correct: check.correct,
      nearMiss: check.nearMiss,
      hintUsed: hintShown,
      timeMs: performance.now() - started,
      given,
      expected: check.expected,
      note: check.note,
    });
  }

  function insert(ch: string) {
    const el = input.current;
    if (!el) return setValue((v) => v + ch);
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + ch + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  }

  const verify = () => {
    if (value.trim()) submit(value);
  };

  // A <div>, not a <form>: iOS Safari offers contact, e-mail or card AutoFill for inputs inside forms.
  return (
    <div className="typing-card">
      <div className="prompt">{prompt(value)}</div>

      {hint && (hintShown ? <p className="hint">
          <Icon name="hint" /> {hint}
        </p> : !locked && (
        <button type="button" className="link-button" onClick={() => setHintShown(true)}>
          <Icon name="hint" /> {ui.showHint}
        </button>
      ))}

      <input
        ref={input}
        type="text"
        inputMode="text"
        name="deja-answer"
        className="answer-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        readOnly={locked}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        lang="fr"
        aria-label={ui.answerLabel}
        placeholder={ui.typePlaceholder}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || locked || e.nativeEvent.isComposing) return;
          e.preventDefault();
          // The session moves on with Enter on window; the press that verifies must not reach it.
          e.stopPropagation();
          verify();
        }}
        onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
      />
      <AccentBar onInsert={insert} disabled={locked} />

      {!locked && (
        <div className="actions">
          <button type="button" className="button secondary" onClick={() => submit('')}>
            {ui.dontKnow}
          </button>
          <button type="button" className="button primary" disabled={!value.trim()} onClick={verify}>
            {ui.check}
          </button>
        </div>
      )}
    </div>
  );
}
