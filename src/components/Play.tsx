import { useRef } from 'react';
import { play, stop, usePlayer } from '../audio/player';
import { audioTextOf } from '../audio/texts';
import type { Audio } from '../content/audio';
import { ui } from '../i18n/ui';
import { Icon } from './Icon';

const HOLD_MS = 450;

/** Plays the recording of a French text; holding it plays slower. Disabled when the recording cannot be had. */
export function Play({ text, audio }: { text: string; audio?: Audio }) {
  const spoken = audioTextOf(text, audio);
  const player = usePlayer();
  const timer = useRef<number | undefined>(undefined);
  const held = useRef(false);
  if (!spoken) return null;

  const active = player.text === spoken ? player.status : null;
  const cancelHold = () => window.clearTimeout(timer.current);

  return (
    <button
      type="button"
      className={`play-button${active ? ` ${active}` : ''}`}
      disabled={player.failed.has(spoken)}
      aria-label={ui.listen}
      title={ui.listenHint}
      onPointerDown={() => {
        held.current = false;
        timer.current = window.setTimeout(() => {
          held.current = true;
          void play(spoken, { slow: true });
        }, HOLD_MS);
      }}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (held.current) {
          held.current = false;
          return;
        }
        if (active) stop();
        else void play(spoken);
      }}
    >
      <Icon name="speaker" />
    </button>
  );
}
