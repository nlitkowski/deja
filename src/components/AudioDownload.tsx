import { useEffect, useMemo, useState } from 'react';
import { fetchAudio, isCached } from '../audio/player';
import { collectAudioTexts, type AudioScope } from '../audio/texts';
import { content } from '../content/registry';
import { ui } from '../i18n/ui';
import { Icon } from './Icon';

const PARALLEL = 4;

type State = { kind: 'idle' } | { kind: 'loading'; done: number; total: number } | { kind: 'done'; bytes: number; missing: number };

/** Saves every recording of some units and sheets for offline use. Give it a `key` per screen so it starts over. */
export function AudioDownload({ units = [], sheets = [] }: { units?: readonly string[]; sheets?: readonly string[] }) {
  const scopeKey = JSON.stringify([units, sheets]);
  const texts = useMemo(() => {
    const [u, s] = JSON.parse(scopeKey) as [string[], string[]];
    const scope: AudioScope = { units: new Set(u), sheets: new Set(s) };
    return collectAudioTexts(content, scope).map((t) => t.text);
  }, [scopeKey]);
  const [state, setState] = useState<State>({ kind: 'idle' });

  // Already all offline: show it as done, with its size.
  useEffect(() => {
    let live = true;
    void Promise.all(texts.map(isCached)).then((cached) => {
      if (live && cached.length && cached.every(Boolean)) void download(texts, () => live, setState);
    });
    return () => {
      live = false;
    };
  }, [texts]);

  if (!texts.length) return null;
  return (
    <div className="audio-download">
      {state.kind === 'idle' && (
        <button className="button" onClick={() => void download(texts, () => true, setState)}>
          <Icon name="download" /> {ui.downloadAudio}
        </button>
      )}
      {state.kind === 'loading' && <span className="muted small">{ui.downloadingAudio(state.done, state.total)}</span>}
      {state.kind === 'done' && (
        <>
          <span className="muted small">{ui.audioReady(ui.fileSize(state.bytes))}</span>
          {state.missing > 0 && <span className="muted small">{ui.audioPartly(state.missing)}</span>}
        </>
      )}
    </div>
  );
}

/** Fetches every text (cached ones come straight from the cache), a few at a time. */
async function download(texts: readonly string[], live: () => boolean, setState: (s: State) => void) {
  let done = 0;
  let bytes = 0;
  let missing = 0;
  const queue = [...texts];
  setState({ kind: 'loading', done, total: texts.length });
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      for (let text = queue.shift(); text !== undefined; text = queue.shift()) {
        try {
          bytes += (await fetchAudio(text)).size;
        } catch {
          missing += 1;
        }
        done += 1;
        if (live()) setState({ kind: 'loading', done, total: texts.length });
      }
    }),
  );
  if (live()) setState({ kind: 'done', bytes, missing });
}
