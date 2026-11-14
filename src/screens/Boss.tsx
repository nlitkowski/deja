import { useCallback, useEffect, useState } from 'react';
import { buildBoss } from '../bosses';
import { Emoji } from '../components/Emoji';
import { Icon } from '../components/Icon';
import { GapFillView } from '../exercises/gap-fill/View';
import { MultipleChoiceView } from '../exercises/multiple-choice/View';
import { accentPairs } from '../content/registry';
import { bossAnswer, startBoss } from '../game/boss';
import { answerXp, allMastered } from '../game/xp';
import { ui } from '../i18n/ui';
import { dayKey } from '../lib/date';
import { newEventId } from '../lib/progress/events';
import { isDue, type AnswerResult } from '../lib/srs';
import { sfx } from '../sfx';
import { useAppStore } from '../state/appStore';
import { xpContext } from '../xpContext';
import type { SessionOutcome } from './Session';

interface Props {
  unitKey: string;
  title: string;
  onExit: () => void;
  onFinish: (outcome: SessionOutcome) => void;
}

const AUTO_ADVANCE_MS = 900;

/** A session with lives and a clock per question: choices between confusables and typed gaps. */
export function Boss({ unitKey, title, onExit, onFinish }: Props) {
  const [boss] = useState(() => buildBoss(unitKey));
  const [session] = useState(() => ({ id: newEventId(), startedAt: new Date().toISOString() }));
  const [run, setRun] = useState(() => startBoss(boss?.lives ?? 0));
  const [result, setResult] = useState<AnswerResult>();
  const [combo, setCombo] = useState({ now: 0, max: 0 });
  const [gain, setGain] = useState<{ xp: number; key: number }>();

  const { helpLang, vibration, sound } = useAppStore((s) => s.settings);
  const recordAnswer = useAppStore((s) => s.recordAnswer);
  const recordSession = useAppStore((s) => s.recordSession);

  const total = boss?.questions.length ?? 0;
  // `run.index` moves on as soon as an answer is in; the question stays on screen until "next".
  const shown = result ? run.index - 1 : run.index;
  const question = boss?.questions[shown];

  const finish = useCallback(() => {
    const defeated = !!run.defeated;
    recordSession({
      sessionId: session.id,
      kind: 'boss',
      unitKey,
      startedAt: session.startedAt,
      items: run.correct + run.mistakes,
      correct: run.correct,
      mistakes: run.mistakes,
      maxCombo: combo.max,
      defeated,
    });
    onFinish({ sessionId: session.id, title, answered: run.correct + run.mistakes, correct: run.correct, nearMiss: 0, entriesReviewed: run.correct + run.mistakes, boss: { defeated } });
  }, [run, combo.max, recordSession, session, unitKey, title, onFinish]);

  const next = useCallback(() => {
    if (run.defeated !== undefined) return finish();
    setResult(undefined);
  }, [run.defeated, finish]);

  function handleAnswer(r: AnswerResult) {
    if (!question || result) return;
    setResult(r);
    const cards = useAppStore.getState().progress.cards;
    const card = cards[question.entryId];
    const typed = question.kind === 'typed';
    const event = recordAnswer({
      exerciseId: question.exerciseId,
      entryIds: [question.entryId],
      // Choosing never schedules a card as "easy", as in sessions.
      result: typed ? r : { ...r, grade: r.correct ? 'good' : 'again' },
      early: !!card && !isDue(card, dayKey(new Date())),
      sessionId: session.id,
      comboBefore: combo.now,
      production: typed,
    });
    const xp = answerXp(event, xpContext, allMastered([question.entryId], cards)).total;
    setGain(xp ? { xp, key: run.index } : undefined);
    const streak = r.correct ? combo.now + 1 : 0;
    setCombo({ now: streak, max: Math.max(combo.max, streak) });
    setRun(bossAnswer(run, r.correct, total));
    if (sound) {
      if (r.correct) sfx.correct(streak);
      else sfx.wrong();
    }
    if (vibration) {
      try {
        navigator.vibrate?.(r.correct ? 15 : [30, 40, 30]);
      } catch {
        // Unsupported or blocked: haptics are optional.
      }
    }
  }

  useEffect(() => {
    if (result || !question || !boss) return;
    const timer = window.setTimeout(
      () => handleAnswer({ correct: false, nearMiss: false, hintUsed: false, timeMs: boss.secondsPerQuestion * 1000, expected: question.answers[0] }),
      boss.secondsPerQuestion * 1000,
    );
    return () => window.clearTimeout(timer);
    // One clock per question; handleAnswer reads the render it was scheduled in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, result]);

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    const timer = result.correct ? window.setTimeout(next, AUTO_ADVANCE_MS) : undefined;
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [result, next]);

  if (!boss || !question) {
    return (
      <main className="screen">
        <p>{ui.noCards}</p>
        <button className="button primary" onClick={onExit}>
          {ui.back}
        </button>
      </main>
    );
  }

  const ctx = { accentPairs, helpLang };
  const tone = result ? (result.correct ? 'ok' : 'bad') : '';
  const timedOut = result && !result.correct && result.given === undefined;
  const lives = boss.lives;

  return (
    <main className="screen session boss">
      <header className="session-header">
        <button className="icon-button" onClick={onExit} aria-label={ui.closeSession}>
          <Icon name="close" />
        </button>
        <p className="boss-title">
          <Emoji char="🐉" /> {ui.bossOf(title)}
        </p>
        <span className="lives" role="img" aria-label={ui.livesLabel(run.lives)}>
          {Array.from({ length: lives }, (_, i) => (
            <span key={i} className={i < run.lives ? 'life' : 'life lost'} aria-hidden>
              <Emoji char={i < run.lives ? '❤️' : '🖤'} />
            </span>
          ))}
        </span>
      </header>

      <div className="boss-meta">
        <span className="muted small">{ui.question(shown + 1, total)}</span>
        <span className="duel-timer boss-timer" aria-hidden>
          <span key={shown} className={result ? 'paused' : ''} style={{ animationDuration: `${boss.secondsPerQuestion}s` }} />
        </span>
      </div>

      <section className={`card ${tone}`}>
        {result && gain && (
          <span key={gain.key} className="xp-gain" aria-hidden>
            {ui.xpGain(gain.xp)}
          </span>
        )}
        {question.kind === 'choice' ? (
          <MultipleChoiceView
            key={shown}
            data={{ sentence: question.sentence, answer: question.answers[0]!, options: question.options!, pl: question.pl, clue: question.clue }}
            ctx={ctx}
            locked={!!result}
            onAnswer={handleAnswer}
          />
        ) : (
          <GapFillView
            key={shown}
            data={{ sentence: question.sentence, answers: question.answers, pl: question.pl, clue: question.clue }}
            ctx={ctx}
            locked={!!result}
            onAnswer={handleAnswer}
          />
        )}
      </section>

      {result && (
        <section className={`feedback ${tone}`} role="status">
          <p className="feedback-title">{result.correct ? ui.correct : timedOut ? ui.timeUp : ui.wrong}</p>
          {!result.correct && (
            <p>
              {ui.correctAnswer} <strong lang="fr">{question.answers[0]}</strong>
            </p>
          )}
          <button className="button primary" onClick={next} autoFocus={!result.correct}>
            {run.defeated === undefined ? ui.next : ui.continue}
          </button>
        </section>
      )}
    </main>
  );
}
