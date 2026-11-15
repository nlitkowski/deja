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
import { PackScreen } from './screens/PackScreen';
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
  | { name: 'boss'; unitKey: string; listening?: boolean }
  | { name: 'pack'; packId: string }
  | { name: 'summary'; outcome: SessionOutcome; unitKey?: string }
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
  // A unit session or boss ends back on its pack's path, a cross-pack review on the home screen.
  const exitTo = (unitKey?: string) => {
    const packId = unitKey && content.units.get(unitKey)?.packId;
    setScreen(packId ? { name: 'pack', packId } : { name: 'home' });
  };
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
          onOpenPack={(packId) => setScreen({ name: 'pack', packId })}
          onOpenAchievements={() => setScreen({ name: 'achievements' })}
          onOpenLeague={() => setScreen({ name: 'league' })}
          onOpenStats={() => setScreen({ name: 'stats' })}
        />
      );
    case 'pack':
      return (
        <PackScreen
          packId={screen.packId}
          onBack={home}
          onPractice={(unitKey) => startSession(content.units.get(unitKey)?.title ?? '', unitSession(unitKey), unitKey)}
          onBoss={(unitKey, listening) => setScreen({ name: 'boss', unitKey, listening })}
          onOpenSheet={(key) => setScreen({ name: 'sheet', key })}
        />
      );
    case 'session': {
      const { unitKey } = screen;
      return (
        <Session
          title={screen.title}
          initialItems={screen.items}
          unitKey={unitKey}
          onExit={() => exitTo(unitKey)}
          onFinish={(outcome) => setScreen({ name: 'summary', outcome, unitKey })}
        />
      );
    }
    case 'boss': {
      const { unitKey, listening } = screen;
      return (
        <Boss
          unitKey={unitKey}
          listening={listening}
          title={content.units.get(unitKey)?.title ?? ''}
          onExit={() => exitTo(unitKey)}
          onFinish={(outcome) => setScreen({ name: 'summary', outcome, unitKey })}
        />
      );
    }
    case 'summary': {
      const { unitKey } = screen;
      return <SessionSummary outcome={screen.outcome} onDone={() => exitTo(unitKey)} />;
    }
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
