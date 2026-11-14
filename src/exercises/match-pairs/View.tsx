import { useEffect, useState } from 'react';
import { ui } from '../../i18n/ui';
import { shuffle } from '../../lib/session';
import type { ViewProps } from '../types';
import type { MatchPairsData } from '.';

type Side = 'fr' | 'pl';

const WRONG_MS = 500;

export function MatchPairsView({ data, locked, onAnswer }: ViewProps<MatchPairsData>) {
  const [columns] = useState(() => ({ fr: shuffle(data.pairs, Math.random), pl: shuffle(data.pairs, Math.random) }));
  const [started] = useState(() => performance.now());
  const [selected, setSelected] = useState<{ side: Side; entryId: string }>();
  const [matched, setMatched] = useState<Record<string, number>>({});
  const [mistakes, setMistakes] = useState<ReadonlySet<string>>(new Set());
  const [wrong, setWrong] = useState<string[]>([]);
  const [seconds, setSeconds] = useState(0);

  const done = Object.keys(matched).length === data.pairs.length;

  useEffect(() => {
    if (done || locked) return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [done, locked]);

  useEffect(() => {
    if (!wrong.length) return;
    const timer = window.setTimeout(() => setWrong([]), WRONG_MS);
    return () => window.clearTimeout(timer);
  }, [wrong]);

  /** `at`: the click's timestamp, on the same clock as `performance.now()`. */
  function tap(side: Side, entryId: string, at: number) {
    if (locked || done || matched[entryId] !== undefined) return;
    if (!selected || selected.side === side) {
      setSelected({ side, entryId });
      return;
    }
    setSelected(undefined);
    if (selected.entryId !== entryId) {
      // The mistake belongs to the card picked first: that is the one the user did not know.
      setMistakes(new Set(mistakes).add(selected.entryId));
      setWrong([`${selected.side}:${selected.entryId}`, `${side}:${entryId}`]);
      return;
    }
    const next = { ...matched, [entryId]: at - started };
    setMatched(next);
    if (Object.keys(next).length === data.pairs.length) {
      const missed = data.pairs.filter((p) => mistakes.has(p.entryId));
      onAnswer({
        correct: missed.length === 0,
        nearMiss: false,
        hintUsed: false,
        timeMs: at - started,
        expected: missed.map((p) => `${p.fr} = ${p.pl}`).join(' · '),
        parts: data.pairs.map((p) => ({ entryIds: [p.entryId], correct: !mistakes.has(p.entryId), timeMs: next[p.entryId]! })),
      });
    }
  }

  const card = (side: Side, pair: MatchPairsData['pairs'][number]) => {
    const key = `${side}:${pair.entryId}`;
    const state =
      matched[pair.entryId] !== undefined
        ? ' matched'
        : wrong.includes(key)
          ? ' wrong'
          : selected?.side === side && selected.entryId === pair.entryId
            ? ' selected'
            : '';
    return (
      <button
        key={key}
        className={`pair-card${state}`}
        lang={side}
        aria-pressed={state === ' selected'}
        disabled={locked || matched[pair.entryId] !== undefined}
        onClick={(e) => tap(side, pair.entryId, e.timeStamp)}
      >
        {pair[side]}
      </button>
    );
  };

  return (
    <div className="pairs-card">
      <div className="duel-head">
        <span className="muted small">{ui.matchPairs}</span>
        <span className="muted small" aria-label={ui.elapsed(seconds)}>
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </span>
      </div>
      <div className="pairs">
        <div className="pairs-column">{columns.fr.map((p) => card('fr', p))}</div>
        <div className="pairs-column">{columns.pl.map((p) => card('pl', p))}</div>
      </div>
    </div>
  );
}
