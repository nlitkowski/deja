import { AccountCard } from '../components/AccountCard';
import { AudioCard } from '../components/AudioCard';
import { BackupCard } from '../components/BackupCard';
import { Icon } from '../components/Icon';
import { PalettePicker } from '../components/PalettePicker';
import { Segmented } from '../components/Segmented';
import { HELP_LANGS } from '../content/localized';
import { ui } from '../i18n/ui';
import { GAME } from '../game/config';
import { COLOR_MODES, type Settings } from '../lib/storage';
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

      <AccountCard />

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
        <Segmented
          label={ui.dailyGoalLabel}
          value={String(settings.dailyGoal)}
          options={GAME.streak.goals.map((g) => ({ value: String(g), label: ui.goalOption(g), detail: ui.goalMinutes(GAME.streak.goalMinutes[g]!) }))}
          onChange={(goal) => set({ dailyGoal: Number(goal) as Settings['dailyGoal'] })}
        />
        <p className="muted small">{ui.dailyGoalHint}</p>
      </section>

      <section className="settings-card">
        <label className="toggle">
          <input type="checkbox" checked={settings.sound} onChange={(e) => set({ sound: e.target.checked })} />
          <span>{ui.sound}</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={settings.vibration} onChange={(e) => set({ vibration: e.target.checked })} />
          <span>{ui.vibration}</span>
        </label>
      </section>

      <AudioCard />

      <BackupCard />
    </main>
  );
}
