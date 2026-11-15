import { useEffect, useState } from 'react';
import { cachedBytes, clearCache } from '../audio/player';
import { ui } from '../i18n/ui';
import { READ_AFTER } from '../lib/storage';
import { useAppStore } from '../state/appStore';
import { Segmented } from './Segmented';

export function AudioCard() {
  const readAfter = useAppStore((s) => s.settings.readAfter);
  const set = useAppStore((s) => s.updateSettings);
  const [bytes, setBytes] = useState<number>();

  useEffect(() => {
    let live = true;
    void cachedBytes().then((b) => live && setBytes(b));
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="settings-card">
      <Segmented
        label={ui.readAfterLabel}
        value={readAfter}
        options={READ_AFTER.map((v) => ({ value: v, label: ui.readAfterNames[v] }))}
        onChange={(value) => set({ readAfter: value })}
      />
      <p className="muted small">{ui.readAfterHint}</p>
      {bytes !== undefined && (
        <div className="audio-download">
          <span className="small">{bytes ? ui.audioStorage(ui.fileSize(bytes)) : ui.audioStorageEmpty}</span>
          {bytes > 0 && (
            <button className="button" onClick={() => void clearCache().then(() => setBytes(0))}>
              {ui.clearAudio}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
