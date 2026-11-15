import { stop } from '../audio/player';
import { ui } from '../i18n/ui';
import { useAppStore } from '../state/appStore';
import { useQuiet } from '../state/quiet';
import { Icon } from './Icon';

/** 🎧 / 🔇: listening and speaking on or off. */
export function QuietToggle() {
  const chosen = useAppStore((s) => s.settings.quiet);
  const set = useAppStore((s) => s.updateSettings);
  const { quiet, forced } = useQuiet();
  const label = forced ? ui.quietForced : quiet ? ui.quietOn : ui.quietOff;
  return (
    <button
      className={`icon-button quiet-toggle${quiet ? ' on' : ''}`}
      aria-pressed={quiet}
      disabled={forced}
      onClick={() => {
        if (!chosen) stop();
        set({ quiet: !chosen });
      }}
      aria-label={label}
      title={label}
    >
      <Icon name={quiet ? 'muted' : 'headphones'} />
    </button>
  );
}
