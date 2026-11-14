import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { localize } from '../content/localized';
import { accentPairs, content } from '../content/registry';
import { exerciseTypes, isProduction, supportsHelpLang } from '../exercises/registry';
import type { ExerciseContext } from '../exercises/types';
import { ui } from '../i18n/ui';
import { dayKey } from '../lib/date';
import { indexExercisesByEntry, requeue, type SessionItem } from '../lib/session';
import { gradeFromResult, review, type AnswerResult } from '../lib/srs';
import type { SavedState } from '../lib/storage';

export interface SessionOutcome {
  title: string;
  answered: number;
  correct: number;
  nearMiss: number;
  entriesReviewed: number;
}

interface Props {
  title: string;
  initialItems: SessionItem[];
  state: SavedState;
  update: (fn: (s: SavedState) => SavedState) => void;
  onExit: () => void;
  onFinish: (outcome: SessionOutcome) => void;
}

const AUTO_ADVANCE_MS = 900;

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Unsupported or blocked: haptics are optional.
  }
}

export function Session({ title, initialItems, state, update, onExit, onFinish }: Props) {
  const [queue, setQueue] = useState(initialItems);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<AnswerResult>();
  const stats = useRef({ answered: 0, correct: 0, nearMiss: 0, entries: new Set<string>() });

  const { helpLang } = state.settings;
  const ctx: ExerciseContext = useMemo(() => ({ accentPairs, helpLang }), [helpLang]);
  const byEntry = useMemo(
    () => indexExercisesByEntry([...content.exercises.values()].filter((ex) => supportsHelpLang(ex.type, helpLang))),
    [helpLang],
  );

  const item = queue[index];
  const exercise = item && content.exercises.get(item.exerciseId);
  const type = exercise && exerciseTypes.get(exercise.type);
  const entry = item && content.entries.get(item.entryId);

  const next = useCallback(() => {
    if (index + 1 >= queue.length) {
      const s = stats.current;
      onFinish({ title, answered: s.answered, correct: s.correct, nearMiss: s.nearMiss, entriesReviewed: s.entries.size });
      return;
    }
    setResult(undefined);
    setIndex(index + 1);
  }, [index, queue.length, onFinish, title]);

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    const timer = result.correct && !result.nearMiss ? window.setTimeout(next, AUTO_ADVANCE_MS) : undefined;
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [result, next]);

  if (!item || !exercise || !type || !entry) {
    return (
      <main className="screen">
        <p>{ui.noCards}</p>
        <button className="button primary" onClick={onExit}>
          {ui.back}
        </button>
      </main>
    );
  }

  function handleAnswer(r: AnswerResult) {
    if (!item || !exercise) return;
    setResult(r);
    const s = stats.current;
    s.answered += 1;
    if (r.correct) s.correct += 1;
    if (r.nearMiss) s.nearMiss += 1;
    exercise.entryIds.forEach((id) => s.entries.add(id));
    if (state.settings.vibration) vibrate(r.correct ? 15 : [30, 40, 30]);

    if (!r.correct) setQueue((q) => requeue(q, index, item, byEntry.get(item.entryId) ?? [], isProduction));
    if (item.early && r.correct) return;

    const grade = gradeFromResult(r);
    const today = dayKey(new Date());
    update((current) => {
      const srs = { ...current.srs };
      let fresh = 0;
      for (const id of exercise.entryIds) {
        if (!srs[id]) fresh += 1;
        srs[id] = review(srs[id], grade, today);
      }
      return { ...current, srs, daily: { ...current.daily, newIntroduced: current.daily.newIntroduced + fresh } };
    });
  }

  const View = type.View;
  const example = entry.examples[0];
  const meaning = helpLang === 'fr' ? (entry.def ?? entry.pl) : entry.pl;
  const tip = localize(entry.tip, helpLang);
  const tone = result ? (result.correct ? (result.nearMiss ? 'near' : 'ok') : 'bad') : '';

  return (
    <main className="screen session">
      <header className="session-header">
        <button className="icon-button" onClick={onExit} aria-label={ui.closeSession}>
          ✕
        </button>
        <div className="progress session-progress" aria-label={ui.cardOf(index + 1, queue.length)}>
          <span style={{ width: `${(index / queue.length) * 100}%` }} />
        </div>
        <span className="muted small">
          {index + 1}/{queue.length}
        </span>
      </header>

      <section className={`card ${tone}`}>
        <View key={`${index}:${item.exerciseId}`} data={exercise.data} ctx={ctx} locked={!!result} onAnswer={handleAnswer} />
      </section>

      {result && (
        <section className={`feedback ${tone}`} role="status">
          {tone === 'ok' && <p className="feedback-title">{ui.correct}</p>}
          {tone === 'near' && (
            <>
              <p className="feedback-title">{ui.nearMiss}</p>
              <p>
                {ui.correctAnswer} <strong lang="fr">{result.expected}</strong>
              </p>
            </>
          )}
          {tone === 'bad' && (
            <>
              <p className="feedback-title">{result.given ? ui.wrong : ui.answerWas}</p>
              <p>
                {ui.correctAnswer} <strong lang="fr">{result.expected}</strong>
                {result.given && (
                  <>
                    {' · '}
                    {ui.yourAnswer} <s lang="fr">{result.given}</s>
                  </>
                )}
              </p>
            </>
          )}
          {tone !== 'ok' && (
            <div className="explain">
              <p>
                <strong lang="fr">{entry.fr}</strong> = <span lang={helpLang}>{meaning}</span>
              </p>
              {tip && <p lang={helpLang}>💡 {tip}</p>}
              {example && (
                <p className="example">
                  <span lang="fr">{example.fr}</span>
                  {helpLang === 'pl' && (
                    <>
                      <br />
                      <span className="muted" lang="pl">
                        {example.pl}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          )}
          <button className="button primary" onClick={next} autoFocus={tone !== 'ok'}>
            {ui.next}
          </button>
        </section>
      )}
    </main>
  );
}
