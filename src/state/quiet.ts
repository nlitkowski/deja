import { useEffect, useState, useSyncExternalStore } from 'react';
import { hasCachedAudio } from '../audio/player';
import { useAppStore } from './appStore';

const subscribeOnline = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

/**
 * Quiet mode: chosen in settings, or forced while there is neither network nor any recording offline
 * (listening cards could not play). Due listening cards just wait: SRS only counts answers given.
 */
export function useQuiet(): { quiet: boolean; forced: boolean } {
  const chosen = useAppStore((s) => s.settings.quiet);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [hasAudio, setHasAudio] = useState(true);

  useEffect(() => {
    if (online) return;
    let live = true;
    void hasCachedAudio().then((has) => live && setHasAudio(has));
    return () => {
      live = false;
    };
  }, [online]);

  const forced = !online && !hasAudio;
  return { quiet: chosen || forced, forced };
}
