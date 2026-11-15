import { useEffect } from 'react';
import { play, usePlayer } from '../audio/player';
import { ui } from '../i18n/ui';
import { Icon } from './Icon';

/** The prompt of a listening exercise: plays once on its own (`slow`ly for a new card), then again (or slower) on demand. */
export function Listen({ text, slow = false, onReplay }: { text: string; slow?: boolean; onReplay: () => void }) {
  const player = usePlayer();
  const active = player.text === text ? player.status : null;
  const failed = player.failed.has(text);

  useEffect(() => {
    void play(text, { slow });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the first play is slow
  }, [text]);

  const again = (slow: boolean) => {
    onReplay();
    void play(text, { slow });
  };

  return (
    <div className="listen">
      <button
        type="button"
        className={`listen-button${active ? ` ${active}` : ''}`}
        disabled={failed}
        aria-label={ui.listenAgain}
        title={ui.listenAgain}
        onClick={() => again(false)}
      >
        <Icon name="speaker" />
      </button>
      <button type="button" className="button secondary" disabled={failed} onClick={() => again(true)}>
        {ui.listenSlower}
      </button>
      {failed && <p className="muted small">{ui.audioUnavailable}</p>}
    </div>
  );
}
