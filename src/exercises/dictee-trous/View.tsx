import { useRef } from 'react';
import { Listen } from '../../components/Listen';
import { TypingCard } from '../../components/TypingCard';
import { GAP } from '../gap-fill';
import type { ViewProps } from '../types';
import type { DicteeTrousData } from '.';

export function DicteeTrousView({ data, ctx, locked, onAnswer }: ViewProps<DicteeTrousData>) {
  const replays = useRef(0);
  const [before, after] = data.sentence.split(GAP);
  return (
    <TypingCard
      answers={[data.answer]}
      ctx={ctx}
      locked={locked}
      onAnswer={(r) => onAnswer({ ...r, replays: replays.current })}
      prompt={(value) => (
        <>
          <Listen text={data.audio} onReplay={() => replays.current++} />
          <p className="fr-sentence" lang="fr">
            {before}
            <span className={value ? 'gap filled' : 'gap'}>{value || '   '}</span>
            {after}
          </p>
        </>
      )}
    />
  );
}
