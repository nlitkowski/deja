import { ui } from '../i18n/ui';

const CHARS = ['à', 'â', 'ç', 'é', 'è', 'ê', 'ë', 'î', 'ï', 'ô', 'ù', 'û', '’'];

export function AccentBar({ onInsert, disabled }: { onInsert: (ch: string) => void; disabled?: boolean }) {
  return (
    <div className="accent-bar" role="toolbar" aria-label={ui.accentBarLabel}>
      {CHARS.map((ch) => (
        <button
          key={ch}
          type="button"
          className="accent-key"
          disabled={disabled}
          // Keeps focus (and the mobile keyboard) on the input.
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onInsert(ch)}
        >
          {ch}
        </button>
      ))}
    </div>
  );
}
