import { useEffect, useRef, useState, type ReactNode } from 'react';
import { checkAnswer } from '../lib/answer';
import type { AnswerResult, ExerciseContext } from '../exercises/types';
import { ui } from '../i18n/ui';
import { AccentBar } from './AccentBar';

interface Props {
  answers: string[];
  hint?: string;
  ctx: ExerciseContext;
  locked: boolean;
  onAnswer: (r: AnswerResult) => void;
  /** Renders the prompt; receives the current input so a gap can show it inline. */
  prompt: (value: string) => ReactNode;
}

export function TypingCard({ answers, hint, ctx, locked, onAnswer, prompt }: Props) {
  const [value, setValue] = useState('');
  const [hintShown, setHintShown] = useState(false);
  const started = useState(() => performance.now())[0];
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!locked) input.current?.focus();
  }, [locked]);

  function submit(given: string) {
    if (locked) return;
    const check = checkAnswer(given, answers, ctx.accentPairs);
    onAnswer({
      correct: check.correct,
      nearMiss: check.nearMiss,
      hintUsed: hintShown,
      timeMs: performance.now() - started,
      given,
      expected: check.expected,
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

  return (
    <form
      className="typing-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) submit(value);
      }}
    >
      <div className="prompt">{prompt(value)}</div>

      {hint && (hintShown ? <p className="hint">💡 {hint}</p> : !locked && (
        <button type="button" className="link-button" onClick={() => setHintShown(true)}>
          {ui.showHint}
        </button>
      ))}

      <input
        ref={input}
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
        onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
      />
      <AccentBar onInsert={insert} disabled={locked} />

      {!locked && (
        <div className="actions">
          <button type="button" className="button secondary" onClick={() => submit('')}>
            {ui.dontKnow}
          </button>
          <button type="submit" className="button primary" disabled={!value.trim()}>
            {ui.check}
          </button>
        </div>
      )}
    </form>
  );
}
