import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { localize } from '../content/localized';
import { accentPairs, content } from '../content/registry';
import { exerciseTypes, isProduction, supportsHelpLang } from '../exercises/registry';
import type { ExerciseContext } from '../exercises/types';
import { Icon } from '../components/Icon';
import { GAME } from '../game/config';
import { answerXp } from '../game/xp';
import { ui } from '../i18n/ui';
import { indexExercisesByEntry, requeue, type SessionItem } from '../lib/session';
import { newEventId } from '../lib/progress/events';
import type { AnswerResult } from '../lib/srs';
import { sfx } from '../sfx';
import { useAppStore } from '../state/appStore';
import { xpContext } from '../xpContext';

export interface SessionOutcome {
  sessionId: string;
  title: string;
  answered: number;
  correct: number;
  nearMiss: number;
  entriesReviewed: number;
}

interface Props {
  title: string;
  initialItems: SessionItem[];
  unitKey?: string;
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

export function Session({ title, initialItems, unitKey, onExit, onFinish }: Props) {
  const [queue, setQueue] = useState(initialItems);
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<AnswerResult>();
  const stats = useRef({ answered: 0, correct: 0, nearMiss: 0, maxCombo: 0, entries: new Set<string>() });
  const [session] = useState(() => ({ id: newEventId(), startedAt: new Date().toISOString() }));
  const [combo, setCombo] = useState(0);
  const [comboBreak, setComboBreak] = useState<{ combo: number; key: number }>();
  const [gain, setGain] = useState<{ xp: number; key: number }>();

  const { helpLang, vibration, sound } = useAppStore((s) => s.settings);
  const recordAnswer = useAppStore((s) => s.recordAnswer);
  const recordSession = useAppStore((s) => s.recordSession);
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
      recordSession({
        sessionId: session.id,
        kind: unitKey ? 'unit' : 'review',
        ...(unitKey ? { unitKey } : {}),
        startedAt: session.startedAt,
        items: s.answered,
        correct: s.correct,
        mistakes: s.answered - s.correct,
        maxCombo: s.maxCombo,
      });
      onFinish({ sessionId: session.id, title, answered: s.answered, correct: s.correct, nearMiss: s.nearMiss, entriesReviewed: s.entries.size });
      return;
    }
    setResult(undefined);
    setIndex(index + 1);
  }, [index, queue.length, onFinish, title, recordSession, session, unitKey]);

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
    if (vibration) vibrate(r.correct ? 15 : [30, 40, 30]);

    if (!r.correct) setQueue((q) => requeue(q, index, item, byEntry.get(item.entryId) ?? [], isProduction));
    const event = recordAnswer({
      exerciseId: exercise.id,
      entryIds: exercise.entryIds,
      result: r,
      early: item.early,
      sessionId: session.id,
      comboBefore: combo,
    });

    const nextCombo = r.correct ? combo + 1 : 0;
    s.maxCombo = Math.max(s.maxCombo, nextCombo);
    if (!r.correct && combo >= GAME.comboVisibleFrom) setComboBreak({ combo, key: s.answered });
    setCombo(nextCombo);
    const xp = answerXp(event, xpContext).total;
    setGain(xp ? { xp, key: s.answered } : undefined);
    if (sound) {
      if (r.correct) sfx.correct(nextCombo);
      else sfx.wrong();
    }
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
          <Icon name="close" />
        </button>
        <div className="progress session-progress" aria-label={ui.cardOf(index + 1, queue.length)}>
          <span style={{ width: `${(index / queue.length) * 100}%` }} />
        </div>
        <span className="muted small">
          {index + 1}/{queue.length}
        </span>
      </header>

      <div className="combo-row" aria-live="polite">
        {combo >= GAME.comboVisibleFrom ? (
          <span key={combo} className="combo">
            {ui.combo(combo)}
          </span>
        ) : (
          comboBreak && (
            <span key={`break-${comboBreak.key}`} className="combo broken" aria-hidden>
              {ui.combo(comboBreak.combo)}
            </span>
          )
        )}
      </div>

      <section className={`card ${tone}`}>
        {result && gain && (
          <span key={gain.key} className="xp-gain" aria-hidden>
            {ui.xpGain(gain.xp)}
          </span>
        )}
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
              {tip && (
                <p lang={helpLang}>
                  <Icon name="hint" /> {tip}
                </p>
              )}
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
