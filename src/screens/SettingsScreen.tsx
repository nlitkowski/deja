import { Icon } from '../components/Icon';
import { PalettePicker } from '../components/PalettePicker';
import { Segmented } from '../components/Segmented';
import { HELP_LANGS } from '../content/localized';
import { ui } from '../i18n/ui';
import { COLOR_MODES } from '../lib/storage';
import { useAppStore } from '../state/appStore';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const settings = useAppStore((s) => s.settings);
  const set = useAppStore((s) => s.updateSettings);

  return (
    <main className="screen settings">
      <header className="top-bar">
        <button className="back-button" onClick={onBack}>
          <Icon name="back" /> {ui.back}
        </button>
      </header>
      <h1>{ui.settings}</h1>

      <section className="settings-card">
        <PalettePicker value={settings.palette} onChange={(palette) => set({ palette })} />
        <Segmented
          label={ui.themeLabel}
          value={settings.colorMode}
          options={COLOR_MODES.map((m) => ({ value: m, label: ui.themeNames[m] }))}
          onChange={(colorMode) => set({ colorMode })}
        />
        <p className="muted small">{ui.themeHint}</p>
      </section>

      <section className="settings-card">
        <Segmented
          label={ui.helpLangLabel}
          value={settings.helpLang}
          options={HELP_LANGS.map((l) => ({ value: l, label: ui.helpLangNames[l] }))}
          onChange={(helpLang) => set({ helpLang })}
        />
        <p className="muted small">{ui.helpLangHint}</p>
      </section>

      <section className="settings-card">
        <label className="toggle">
          <input type="checkbox" checked={settings.vibration} onChange={(e) => set({ vibration: e.target.checked })} />
          <span>{ui.vibration}</span>
        </label>
      </section>
    </main>
  );
}
