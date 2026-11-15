import { useRef, useState } from 'react';
import { spoken } from '../../audio/spoken';
import { ChoiceList } from '../../components/ChoiceList';
import { Listen } from '../../components/Listen';
import { Play } from '../../components/Play';
import { ui } from '../../i18n/ui';
import { shuffle } from '../../lib/session';
import type { ViewProps } from '../types';
import type { PairesMinimalesData } from '.';

export function PairesMinimalesView({ data, locked, onAnswer }: ViewProps<PairesMinimalesData>) {
  const [answer] = useState(() => data.pair[Math.random() < 0.5 ? 0 : 1]);
  const [options] = useState(() => shuffle(data.pair, Math.random));
  const [started] = useState(() => performance.now());
  const [chosen, setChosen] = useState<string>();
  const replays = useRef(0);

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
      <Listen text={spoken(answer)} onReplay={() => replays.current++} />
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
    </div>
  );
}
