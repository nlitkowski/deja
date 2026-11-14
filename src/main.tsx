import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/press-start-2p/latin-ext-400.css';
import '@fontsource/vt323/latin-400.css';
import '@fontsource/vt323/latin-ext-400.css';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './App';
import { AchievementToast } from './components/AchievementToast';
import { UpdateToast } from './components/UpdateToast';
import { startSync } from './state/sync';

startSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdateToast />
    <AchievementToast />
  </StrictMode>,
);
