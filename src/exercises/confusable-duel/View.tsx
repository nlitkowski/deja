import { useEffect, useRef, useState } from 'react';
import { ui } from '../../i18n/ui';
import { shuffle } from '../../lib/session';
import { afterGap, fillGap, GAP } from '../gap-fill';
import type { ViewProps } from '../types';
import type { DuelData } from '.';

const FEEDBACK_MS = 600;

interface Pick {
  entryId: string;
  correct: boolean;
  timeMs: number;
}

export function DuelView({ data, ctx, locked, onAnswer }: ViewProps<DuelData>) {
  const [options] = useState(() => data.sentences.map((s) => shuffle(s.options, Math.random)));
  const [index, setIndex] = useState(0);
  /** `null`: the time ran out. */
  const [picked, setPicked] = useState<string | null>();
  const picks = useRef<Pick[]>([]);
  const shownAt = useRef(0);

  const sentence = data.sentences[index]!;
  const [before, after] = sentence.sentence.split(GAP);
  const aid = ctx.helpLang === 'pl' ? sentence.pl : sentence.clue;

  function choose(option: string | null) {
    if (locked || picked !== undefined) return;
    picks.current.push({ entryId: sentence.entryId, correct: option === sentence.answer, timeMs: performance.now() - shownAt.current });
    setPicked(option);
  }

  function finish() {
    const all = picks.current;
    const missed = data.sentences.filter((_, i) => !all[i]?.correct);
    onAnswer({
      correct: missed.length === 0,
      nearMiss: false,
      hintUsed: false,
      timeMs: all.reduce((sum, p) => sum + p.timeMs, 0),
      expected: missed.map((s) => fillGap(s.sentence, s.answer)).join(' · '),
      parts: all.map((p) => ({ entryIds: [p.entryId], correct: p.correct, timeMs: p.timeMs })),
    });
  }

  useEffect(() => {
    if (locked) return;
    if (picked === undefined) {
      shownAt.current = performance.now();
      const timer = window.setTimeout(() => choose(null), data.secondsPerSentence * 1000);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => {
      if (index + 1 < data.sentences.length) {
        setIndex(index + 1);
        setPicked(undefined);
      } else finish();
    }, FEEDBACK_MS);
    return () => window.clearTimeout(timer);
    // choose/finish read the current render; the effect only re-arms per sentence and pick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, picked, locked]);

  return (
    <div className="choice-card duel">
      <div className="duel-head">
        <span className="muted small">{ui.duel}</span>
        <span className="muted small">{ui.duelStep(index + 1, data.sentences.length)}</span>
      </div>
      <span className="duel-timer" aria-hidden>
        <span
          key={index}
          className={picked !== undefined || locked ? 'paused' : ''}
          style={{ animationDuration: `${data.secondsPerSentence}s` }}
        />
      </span>
      <p className="fr-sentence" lang="fr">
        {before}
        <span className={picked ? 'gap filled' : 'gap'}>{picked ?? (picked === null ? sentence.answer : '   ')}</span>
        {afterGap(after ?? '', picked ?? (picked === null ? sentence.answer : ''))}
      </p>
      {aid && (
        <p className="sentence-aid" lang={ctx.helpLang}>
          {aid}
        </p>
      )}
      {picked === null && <p className="duel-timeout">{ui.timeUp}</p>}
      <div className="choices" role="group" aria-label={ui.chooseAnswer}>
        {options[index]!.map((option) => {
          const state = picked === undefined ? '' : option === sentence.answer ? ' right' : option === picked ? ' wrong' : '';
          return (
            <button key={option} className={`choice${state}`} lang="fr" disabled={locked || picked !== undefined} onClick={() => choose(option)}>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
