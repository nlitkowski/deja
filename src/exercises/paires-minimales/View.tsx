import { useEffect, useRef, useState } from 'react';
import { playInTurn, usePlayer } from '../../audio/player';
import { spoken } from '../../audio/spoken';
import { ChoiceList } from '../../components/ChoiceList';
import { Listen } from '../../components/Listen';
import { Play } from '../../components/Play';
import { ui } from '../../i18n/ui';
import { shuffle } from '../../lib/session';
import type { ViewProps } from '../types';
import type { PairesMinimalesData } from '.';

export function PairesMinimalesView({ data, ctx, locked, onAnswer }: ViewProps<PairesMinimalesData>) {
  const [answer] = useState(() => data.pair[Math.random() < 0.5 ? 0 : 1]);
  const [options] = useState(() => shuffle(data.pair, Math.random));
  const [started] = useState(() => performance.now());
  const [chosen, setChosen] = useState<string>();
  const replays = useRef(0);
  const player = usePlayer();
  const missed = !!chosen && chosen !== answer;

  // After a miss both sides play in turn, each lit up while it sounds, so the difference is heard.
  useEffect(() => {
    if (missed) void playInTurn(data.pair.map(spoken));
  }, [missed, data.pair]);

  function choose(option: string) {
    if (locked || chosen) return;
    setChosen(option);
    onAnswer({
      correct: option === answer,
      nearMiss: false,
      hintUsed: false,
      timeMs: performance.now() - started,
      given: option,
      expected: answer,
      replays: replays.current,
    });
  }

  return (
    <div className="choice-card">
      <Listen text={spoken(answer)} slow={ctx.slowFirst} onReplay={() => replays.current++} />
      <p className="muted">{ui.chooseWhatYouHear}</p>
      <ChoiceList
        options={options}
        answer={answer}
        chosen={chosen}
        locked={locked}
        lang="fr"
        onChoose={choose}
        after={(option) => <Play text={option} />}
      />
      {missed && (
        <p className="pair-replay" lang="fr">
          <span className="muted small">{ui.hearTheDifference}</span>
          {data.pair.map((side) => (
            <span key={side} className={player.text === spoken(side) ? 'pair-side playing' : 'pair-side'}>
              {side}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
