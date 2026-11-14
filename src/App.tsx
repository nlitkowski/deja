import { useEffect, useState } from 'react';
import type { HelpLang } from './content/localized';
import { content } from './content/registry';
import type { SessionItem } from './lib/session';
import { ContentErrors } from './screens/ContentErrors';
import { Home } from './screens/Home';
import { Session, type SessionOutcome } from './screens/Session';
import { SessionSummary } from './screens/SessionSummary';
import { SettingsScreen } from './screens/SettingsScreen';
import { SheetList } from './screens/SheetList';
import { SheetView } from './screens/SheetView';
import { buildUnitSession } from './sessions';
import { useAppStore } from './state/appStore';
import { useTheme } from './theme';

type Screen =
  | { name: 'home' }
  | { name: 'session'; title: string; items: SessionItem[]; unitKey?: string }
  | { name: 'summary'; outcome: SessionOutcome }
  | { name: 'sheets' }
  | { name: 'sheet'; key: string }
  | { name: 'settings' };

export function App() {
  const settings = useAppStore((s) => s.settings);
  const status = useAppStore((s) => s.status);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  useTheme(settings.colorMode, settings.palette);

  useEffect(() => {
    void useAppStore.getState().init();
  }, []);

  if (import.meta.env.DEV && content.issues.length) return <ContentErrors issues={content.issues} />;
  // The event log loads in a few milliseconds; render nothing rather than a flash of empty progress.
  if (status === 'loading') return null;

  const home = () => setScreen({ name: 'home' });
  const setHelpLang = (helpLang: HelpLang) => updateSettings({ helpLang });
  const unitSession = (unitKey: string) => buildUnitSession(useAppStore.getState().progress, settings, unitKey);
  const startSession = (title: string, items: SessionItem[], unitKey?: string) => setScreen({ name: 'session', title, items, unitKey });

  switch (screen.name) {
    case 'home':
      return (
        <Home
          onStart={startSession}
          onOpenSheets={() => setScreen({ name: 'sheets' })}
          onOpenSheet={(key) => setScreen({ name: 'sheet', key })}
          onOpenSettings={() => setScreen({ name: 'settings' })}
        />
      );
    case 'session':
      return (
        <Session
          title={screen.title}
          initialItems={screen.items}
          unitKey={screen.unitKey}
          onExit={home}
          onFinish={(outcome) => setScreen({ name: 'summary', outcome })}
        />
      );
    case 'summary':
      return <SessionSummary outcome={screen.outcome} onDone={home} />;
    case 'settings':
      return <SettingsScreen onBack={home} />;
    case 'sheets':
      return (
        <SheetList
          helpLang={settings.helpLang}
          onHelpLang={setHelpLang}
          onOpen={(key) => setScreen({ name: 'sheet', key })}
          onPractice={(unitKey) => startSession(content.units.get(unitKey)?.title ?? '', unitSession(unitKey), unitKey)}
          onBack={home}
        />
      );
    case 'sheet':
      return (
        <SheetView
          sheetKey={screen.key}
          helpLang={settings.helpLang}
          onHelpLang={setHelpLang}
          onPractice={(unitKey) => startSession(content.units.get(unitKey)?.title ?? '', unitSession(unitKey), unitKey)}
          onOpenSheet={(key) => setScreen({ name: 'sheet', key })}
          onBack={() => setScreen({ name: 'sheets' })}
        />
      );
  }
}
