import { useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { Listen } from '../../components/Listen';
import { TypingCard } from '../../components/TypingCard';
import { ui } from '../../i18n/ui';
import { GAP } from '../gap-fill';
import type { ViewProps } from '../types';
import type { DicteeTrousData } from '.';

export function DicteeTrousView({ data, ctx, locked, onAnswer }: ViewProps<DicteeTrousData>) {
  const replays = useRef(0);
  const [replayed, setReplayed] = useState(false);
  const [hinted, setHinted] = useState(false);
  const [before, after] = data.sentence.split(GAP);
  // First letter, then one slot per letter left.
  const empty = hinted ? data.answer[0] + '_'.repeat(data.answer.length - 1) : '   ';
  return (
    <TypingCard
      answers={[data.answer]}
      ctx={ctx}
      locked={locked}
      onAnswer={(r) => onAnswer({ ...r, hintUsed: r.hintUsed || hinted, replays: replays.current })}
      prompt={(value) => (
        <>
          <Listen
            text={data.audio}
            slow={ctx.slowFirst}
            onReplay={() => {
              replays.current++;
              setReplayed(true);
            }}
          />
          <p className="fr-sentence" lang="fr">
            {before}
            <span className={value ? 'gap filled' : 'gap'}>{value || empty}</span>
            {after}
          </p>
          {replayed && !hinted && !locked && (
            <button type="button" className="link-button" onClick={() => setHinted(true)}>
              <Icon name="hint" /> {ui.showHint}
            </button>
          )}
        </>
      )}
    />
  );
}
