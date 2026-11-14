import { useState } from 'react';
import { content } from './content/registry';
import { ContentErrors } from './screens/ContentErrors';
import { Home } from './screens/Home';
import { Session, type SessionOutcome } from './screens/Session';
import { SessionSummary } from './screens/SessionSummary';
import type { SessionItem } from './lib/session';
import { useAppState } from './useAppState';

type Screen =
  | { name: 'home' }
  | { name: 'session'; title: string; items: SessionItem[] }
  | { name: 'summary'; outcome: SessionOutcome };

export function App() {
  const [state, update] = useAppState();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });

  if (import.meta.env.DEV && content.issues.length) return <ContentErrors issues={content.issues} />;

  switch (screen.name) {
    case 'home':
      return <Home state={state} update={update} onStart={(title, items) => setScreen({ name: 'session', title, items })} />;
    case 'session':
      return (
        <Session
          title={screen.title}
          initialItems={screen.items}
          state={state}
          update={update}
          onExit={() => setScreen({ name: 'home' })}
          onFinish={(outcome) => setScreen({ name: 'summary', outcome })}
        />
      );
    case 'summary':
      return <SessionSummary outcome={screen.outcome} onDone={() => setScreen({ name: 'home' })} />;
  }
}
