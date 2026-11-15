import { useRef } from 'react';
import { Listen } from '../../components/Listen';
import { TypingCard } from '../../components/TypingCard';
import { ui } from '../../i18n/ui';
import { checkDictation, type DiffPart } from '../../lib/dictation';
import type { ViewProps } from '../types';
import type { DicteeData } from '.';

export function DicteeView({ data, ctx, locked, onAnswer }: ViewProps<DicteeData>) {
  const replays = useRef(0);
  const check = (given: string) => ({ ...checkDictation(given, data.text, ctx.accentPairs), expected: data.text });
  return (
    <TypingCard
      answers={[data.text]}
      ctx={ctx}
      locked={locked}
      check={check}
      onAnswer={(r) => onAnswer({ ...r, replays: replays.current })}
      prompt={(value) => (
        <>
          <Listen text={data.text} onReplay={() => replays.current++} />
          {locked ? (
            <p className="fr-sentence dictation-diff" lang="fr">
              {check(value).parts.map((part, i) => (
                <Word key={i} part={part} />
              ))}
            </p>
          ) : (
            <p className="muted">{ui.typeWhatYouHear}</p>
          )}
        </>
      )}
    />
  );
}

function Word({ part }: { part: DiffPart }) {
  const { kind, expected, given } = part;
  if (kind === 'ok') return <span className="word ok">{expected} </span>;
  if (kind === 'missing') return <span className="word missing">{expected} </span>;
  if (kind === 'extra') return <del className="word extra">{given} </del>;
  return (
    <span className={`word ${kind}`}>
      <del>{given}</del> <ins>{expected}</ins>{' '}
    </span>
  );
}
