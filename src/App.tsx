import { useEffect, useState } from 'react';
import type { HelpLang } from './content/localized';
import { content } from './content/registry';
import { ui } from './i18n/ui';
import type { SessionItem } from './lib/session';
import { Achievements } from './screens/Achievements';
import { Boss } from './screens/Boss';
import { ContentErrors } from './screens/ContentErrors';
import { Home } from './screens/Home';
import { League } from './screens/League';
import { Session, type SessionOutcome } from './screens/Session';
import { SessionSummary } from './screens/SessionSummary';
import { SettingsScreen } from './screens/SettingsScreen';
import { SheetList } from './screens/SheetList';
import { SheetView } from './screens/SheetView';
import { Stats } from './screens/Stats';
import { buildEntriesSession, buildUnitSession } from './sessions';
import { useAccountStore } from './state/accountStore';
import { useAppStore } from './state/appStore';
import { useTheme } from './theme';

type Screen =
  | { name: 'home' }
  | { name: 'session'; title: string; items: SessionItem[]; unitKey?: string }
  | { name: 'boss'; unitKey: string }
  | { name: 'summary'; outcome: SessionOutcome }
  | { name: 'sheets' }
  | { name: 'sheet'; key: string }
  | { name: 'settings' }
  | { name: 'achievements' }
  | { name: 'league' }
  | { name: 'stats' };

export function App() {
  const settings = useAppStore((s) => s.settings);
  const status = useAppStore((s) => s.status);
  const updateSettings = useAppStore((s) => s.updateSettings);
  // Coming back from Google sign-in lands on Réglages, where the account card shows how it went.
  const [screen, setScreen] = useState<Screen>(() => (useAccountStore.getState().signInResult ? { name: 'settings' } : { name: 'home' }));
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
          onBoss={(unitKey) => setScreen({ name: 'boss', unitKey })}
          onOpenAchievements={() => setScreen({ name: 'achievements' })}
          onOpenLeague={() => setScreen({ name: 'league' })}
          onOpenStats={() => setScreen({ name: 'stats' })}
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
    case 'boss':
      return (
        <Boss
          unitKey={screen.unitKey}
          title={content.units.get(screen.unitKey)?.title ?? ''}
          onExit={home}
          onFinish={(outcome) => setScreen({ name: 'summary', outcome })}
        />
      );
    case 'summary':
      return <SessionSummary outcome={screen.outcome} onDone={home} />;
    case 'league':
      return <League onBack={home} />;
    case 'stats':
      return (
        <Stats onBack={home} onReviseWeak={(ids) => startSession(ui.weakest, buildEntriesSession(useAppStore.getState().progress, settings, ids))} />
      );
    case 'achievements':
      return <Achievements onBack={home} />;
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
