import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Listen } from '../../components/Listen';
import { TypingCard } from '../../components/TypingCard';
import { ui } from '../../i18n/ui';
import { checkDictation, type DiffPart } from '../../lib/dictation';
import type { ViewProps } from '../types';
import type { DicteeData } from '.';

/** One slot per word; with the hint, each shows its first letter. */
const shape = (text: string, hinted: boolean) =>
  text
    .split(' ')
    .filter((w) => /\p{L}/u.test(w))
    .map((w) => (hinted ? (w.length > 1 ? `${w[0]}_` : w) : '_'))
    .join(' ');

export function DicteeView({ data, ctx, locked, onAnswer }: ViewProps<DicteeData>) {
  const replays = useRef(0);
  const [replayed, setReplayed] = useState(false);
  const [hinted, setHinted] = useState(false);
  const check = (given: string) => ({ ...checkDictation(given, data.text, ctx.accentPairs, data.key), expected: data.text });
  return (
    <TypingCard
      answers={[data.text]}
      ctx={ctx}
      locked={locked}
      check={check}
      onAnswer={(r) => onAnswer({ ...r, hintUsed: r.hintUsed || hinted, replays: replays.current })}
      prompt={(value) => (
        <>
          <Listen
            text={data.text}
            slow={ctx.slowFirst}
            onReplay={() => {
              replays.current++;
              setReplayed(true);
            }}
          />
          {locked ? (
            <p className="fr-sentence dictation-diff" lang="fr">
              {check(value).parts.map((part, i) => (
                <Word key={i} part={part} />
              ))}
            </p>
          ) : (
            <>
              <p className="muted">{ui.typeWhatYouHear}</p>
              <p className="dictation-shape" lang="fr" aria-label={ui.wordCount(shape(data.text, false).split(' ').length)}>
                {shape(data.text, hinted)}
              </p>
              {replayed && !hinted && (
                <button type="button" className="link-button" onClick={() => setHinted(true)}>
                  <Icon name="hint" /> {ui.showHint}
                </button>
              )}
            </>
          )}
        </>
      )}
    />
  );
}

function Word({ part }: { part: DiffPart }) {
  const { kind, expected, given } = part;
  // The first half of a hyphenated word (dix-) sits against the second.
  const gap = expected?.endsWith('-') ? '' : ' ';
  if (kind === 'ok') return <span className="word ok">{expected}{gap}</span>;
  if (kind === 'missing') return <span className="word missing">{expected}{gap}</span>;
  if (kind === 'extra') return <del className="word extra">{given} </del>;
  return (
    <span className={`word ${kind}`}>
      <del>{given}</del> <ins>{expected}</ins>{gap}
    </span>
  );
}
