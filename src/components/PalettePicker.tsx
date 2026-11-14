import { useId } from 'react';
import { ui } from '../i18n/ui';
import { PALETTES, type Palette } from '../lib/storage';

/** Each option renders inside its own data-palette scope, so it previews the real fonts and colours. */
export function PalettePicker({ value, onChange }: { value: Palette; onChange: (palette: Palette) => void }) {
  const labelId = useId();
  return (
    <div className="setting">
      <span className="setting-label" id={labelId}>
        {ui.paletteLabel}
      </span>
      <div className="palette-options" role="radiogroup" aria-labelledby={labelId}>
        {PALETTES.map((p) => (
          <button key={p} role="radio" aria-checked={value === p} className="palette-option" onClick={() => onChange(p)}>
            <span className="palette-card" data-palette={p}>
              <span className="palette-hero">
                <span className="palette-title">{ui.paletteNames[p]}</span>
                <span className="palette-cta">OK</span>
              </span>
              <span className="palette-sample" lang="fr">
                Bonjour !
              </span>
              <span className="palette-swatches" aria-hidden>
                <span style={{ background: 'var(--accent)' }} />
                <span style={{ background: 'var(--highlight)' }} />
                <span style={{ background: 'var(--success)' }} />
                <span style={{ background: 'var(--danger)' }} />
              </span>
            </span>
            <span className="palette-caption">{ui.paletteHints[p]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
