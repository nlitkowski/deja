import { useState } from 'react';
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
import { useTheme } from './theme';
import { useAppState } from './useAppState';

type Screen =
  | { name: 'home' }
  | { name: 'session'; title: string; items: SessionItem[] }
  | { name: 'summary'; outcome: SessionOutcome }
  | { name: 'sheets' }
  | { name: 'sheet'; key: string }
  | { name: 'settings' };

export function App() {
  const [state, update] = useAppState();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  useTheme(state.settings.colorMode, state.settings.palette);

  if (import.meta.env.DEV && content.issues.length) return <ContentErrors issues={content.issues} />;

  const home = () => setScreen({ name: 'home' });
  const setHelpLang = (helpLang: HelpLang) => update((s) => ({ ...s, settings: { ...s.settings, helpLang } }));
  const startSession = (title: string, items: SessionItem[]) => setScreen({ name: 'session', title, items });

  switch (screen.name) {
    case 'home':
      return (
        <Home
          state={state}
          update={update}
          onStart={startSession}
          onOpenSheets={() => setScreen({ name: 'sheets' })}
          onOpenSettings={() => setScreen({ name: 'settings' })}
        />
      );
    case 'session':
      return (
        <Session
          title={screen.title}
          initialItems={screen.items}
          state={state}
          update={update}
          onExit={home}
          onFinish={(outcome) => setScreen({ name: 'summary', outcome })}
        />
      );
    case 'summary':
      return <SessionSummary outcome={screen.outcome} onDone={home} />;
    case 'settings':
      return <SettingsScreen settings={state.settings} update={update} onBack={home} />;
    case 'sheets':
      return (
        <SheetList
          helpLang={state.settings.helpLang}
          onHelpLang={setHelpLang}
          onOpen={(key) => setScreen({ name: 'sheet', key })}
          onBack={home}
        />
      );
    case 'sheet':
      return (
        <SheetView
          sheetKey={screen.key}
          helpLang={state.settings.helpLang}
          onHelpLang={setHelpLang}
          onPractice={(unitKey) => startSession(content.units.get(unitKey)?.title ?? '', buildUnitSession(state, unitKey))}
          onBack={() => setScreen({ name: 'sheets' })}
        />
      );
  }
}
