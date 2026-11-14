import { Segmented } from '../components/Segmented';
import { HELP_LANGS } from '../content/localized';
import { ui } from '../i18n/ui';
import { THEMES, type SavedState, type Settings } from '../lib/storage';

interface Props {
  settings: Settings;
  update: (fn: (s: SavedState) => SavedState) => void;
  onBack: () => void;
}

export function SettingsScreen({ settings, update, onBack }: Props) {
  const set = (patch: Partial<Settings>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));

  return (
    <main className="screen settings">
      <header className="top-bar">
        <button className="back-button" onClick={onBack}>
          ‹ {ui.back}
        </button>
      </header>
      <h1>{ui.settings}</h1>

      <section className="settings-card">
        <Segmented
          label={ui.themeLabel}
          value={settings.theme}
          options={THEMES.map((t) => ({ value: t, label: ui.themeNames[t] }))}
          onChange={(theme) => set({ theme })}
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
