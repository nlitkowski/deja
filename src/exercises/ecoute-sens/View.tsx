import { useRef, useState } from 'react';
import { ChoiceList } from '../../components/ChoiceList';
import { Listen } from '../../components/Listen';
import { ui } from '../../i18n/ui';
import { shuffle } from '../../lib/session';
import type { ViewProps } from '../types';
import type { EcouteSensData } from '.';

export function EcouteSensView({ data, locked, onAnswer }: ViewProps<EcouteSensData>) {
  const [options] = useState(() => shuffle(data.options, Math.random));
  const [started] = useState(() => performance.now());
  const [chosen, setChosen] = useState<string>();
  const replays = useRef(0);

  function choose(option: string) {
    if (locked || chosen) return;
    setChosen(option);
    onAnswer({
      correct: option === data.answer,
      nearMiss: false,
      hintUsed: false,
      timeMs: performance.now() - started,
      given: option,
      expected: data.answer,
      replays: replays.current,
    });
  }

  return (
    <div className="choice-card">
      <Listen text={data.audio} onReplay={() => replays.current++} />
      <p className="muted">{ui.chooseMeaning}</p>
      <ChoiceList options={options} answer={data.answer} chosen={chosen} locked={locked} lang="pl" onChoose={choose} />
    </div>
  );
}
