import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { localize } from '../content/localized';
import { accentPairs, content } from '../content/registry';
import { exerciseTypes, isProduction, skillOf, supportsHelpLang } from '../exercises/registry';
import type { ExerciseContext } from '../exercises/types';
import { Icon } from '../components/Icon';
import { Play } from '../components/Play';
import { QuietToggle } from '../components/QuietToggle';
import { useQuiet } from '../state/quiet';
import { play, stop, usePlayer } from '../audio/player';
import { exerciseAudioText } from '../audio/texts';
import { Translation } from '../components/Translation';
import { GAME } from '../game/config';
import { answerXp } from '../game/xp';
import { ui } from '../i18n/ui';
import { indexExercisesByEntry, requeue, type SessionItem } from '../lib/session';
import { newEventId } from '../lib/progress/events';
import { dayKey } from '../lib/date';
import { cardKey, isDue, type AnswerResult } from '../lib/srs';
import { sfx } from '../sfx';
import { useAppStore } from '../state/appStore';
import { xpContext } from '../xpContext';
import { listeningRetry } from '../sessions';

export interface SessionOutcome {
  sessionId: string;
  title: string;
  answered: number;
  correct: number;
  nearMiss: number;
  entriesReviewed: number;
  boss?: { defeated: boolean };
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

  const { helpLang, vibration, sound, readAfter, slowFirst } = useAppStore((s) => s.settings);
  const player = usePlayer();
  const { quiet } = useQuiet();
  const recordAnswer = useAppStore((s) => s.recordAnswer);
  const recordSession = useAppStore((s) => s.recordSession);
  const byEntry = useMemo(
    () => indexExercisesByEntry([...content.exercises.values()].filter((ex) => supportsHelpLang(ex.type, helpLang))),
    [helpLang],
  );

  const item = queue[index];
  const exercise = item && content.exercises.get(item.exerciseId);
  const type = exercise && exerciseTypes.get(exercise.type);
  const entry = item && content.entries.get(item.entryId);
  // Decided when the card comes up (not subscribed): answering creates the card, and the view must not change then.
  const newListening = !!item && item.skill === 'listening' && !useAppStore.getState().progress.cards[cardKey(item.entryId, 'listening')];
  const ctx: ExerciseContext = useMemo(
    () => ({ accentPairs, helpLang, slowFirst: slowFirst && newListening }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed per card, see newListening
    [helpLang, slowFirst, index],
  );
  const sentence = exercise && readAfter !== 'never' ? exerciseAudioText(exercise) : undefined;
  // A correct answer moves on by itself, but only once the sentence being read has finished.
  const reading = !!sentence && player.text === sentence && !!player.status;

  const next = useCallback(() => {
    // In quiet mode (perhaps turned on mid-session) the listening and speaking cards still to come are dropped.
    const rest = queue.slice(index + 1);
    const kept = quiet ? rest.filter((i) => i.skill === 'written') : rest;
    if (kept.length !== rest.length) setQueue([...queue.slice(0, index + 1), ...kept]);
    if (!kept.length) {
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
    stop();
    setResult(undefined);
    setIndex(index + 1);
  }, [index, queue, quiet, onFinish, title, recordSession, session, unitKey]);

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    const timer = result.correct && !result.nearMiss && !reading ? window.setTimeout(next, AUTO_ADVANCE_MS) : undefined;
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [result, next, reading]);

  useEffect(() => stop, []);


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
    // Read back only to correct a slip: a clean answer moves on, and a listening exercise has just played the sentence.
    const slip = !r.correct || r.nearMiss;
    if (readAfter === 'auto' && slip && !quiet && sentence && item.skill === 'written') void play(sentence);
    if (vibration) vibrate(r.correct ? 15 : [30, 40, 30]);
    if (!r.correct) {
      const candidates = (byEntry.get(item.entryId) ?? []).filter((ex) => skillOf(ex.type) === item.skill);
      const retry = item.skill === 'listening' ? listeningRetry(useAppStore.getState().progress.cards) : undefined;
      setQueue((q) => requeue(q, index, item, candidates, isProduction, Math.random, retry));
    }

    const recognition = !isProduction(exercise.type);
    const today = dayKey(new Date());
    const cards = useAppStore.getState().progress.cards;
    // Other entries of a duel or pairs count as early practice when they are not due yet, like the session's own entries.
    const skill = skillOf(exercise.type);
    const isEarly = (ids: string[]) =>
      ids.every((id) => (id === item.entryId ? item.early : !!cards[cardKey(id, skill)] && !isDue(cards[cardKey(id, skill)]!, today)));
    const parts = r.parts ?? [{ entryIds: exercise.entryIds, correct: r.correct, timeMs: r.timeMs }];

    const s = stats.current;
    let streak = combo;
    let xp = 0;
    let broken = 0;
    const answeredAt = Date.now();
    for (const [i, part] of parts.entries()) {
      const partResult: AnswerResult = r.parts ? { ...r, correct: part.correct, timeMs: part.timeMs, parts: undefined } : r;
      // Picking an answer is easier than typing it: recognition never schedules a card as "easy".
      const graded = recognition ? { ...partResult, grade: partResult.grade ?? (part.correct ? 'good' : 'again') } : partResult;
      const event = recordAnswer(
        { exerciseId: exercise.id, entryIds: part.entryIds, result: graded, early: isEarly(part.entryIds), sessionId: session.id, comboBefore: streak, skill },
        // One millisecond apart, so the log keeps the parts in the order they were answered.
        new Date(answeredAt + i),
      );
      xp += answerXp(event, xpContext).total;
      if (!part.correct && streak >= GAME.comboVisibleFrom) broken = streak;
      streak = part.correct ? streak + 1 : 0;
      s.maxCombo = Math.max(s.maxCombo, streak);
      s.answered += 1;
      if (part.correct) s.correct += 1;
      part.entryIds.forEach((id) => s.entries.add(id));
    }
    if (r.nearMiss) s.nearMiss += 1;

    if (broken) setComboBreak({ combo: broken, key: s.answered });
    setCombo(streak);
    setGain(xp ? { xp, key: s.answered } : undefined);
    if (sound) {
      if (r.correct) sfx.correct(streak);
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
        <QuietToggle />
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
          {tone === 'ok' && result.note === 'ne-dropped' && (
            <p>
              {ui.neDropped} <strong lang="fr">{result.expected}</strong>
            </p>
          )}
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
              {result.note === 'hyphen' && <p>{ui.parceQueHyphen}</p>}
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
          {sentence && (
            <p className="read-after">
              <Play text={sentence} />
              <span lang="fr">{sentence}</span>
            </p>
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
                  <Play text={example.fr} audio={example.audio} />
                  {helpLang === 'pl' ? (
                    <Translation key={example.fr} text={example.pl} lang="pl">
                      {example.fr}
                    </Translation>
                  ) : (
                    <span lang="fr">{example.fr}</span>
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
