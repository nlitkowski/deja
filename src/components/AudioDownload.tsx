import { useEffect, useMemo, useState } from 'react';
import { downloadAll, type DownloadDeps, type DownloadProgress } from '../audio/download';
import { cachedSize, fetchAudio, isCached } from '../audio/player';
import { collectAudioTexts, type AudioScope } from '../audio/texts';
import { content } from '../content/registry';
import { ui } from '../i18n/ui';
import { Icon } from './Icon';

const deps: DownloadDeps = { fetchAudio, isCached, cachedSize, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

type State =
  | { kind: 'checking' }
  /** `cached`: already offline from an earlier, unfinished download. */
  | { kind: 'idle'; cached: number }
  | { kind: 'loading'; progress: DownloadProgress }
  | { kind: 'interrupted'; cached: number }
  | { kind: 'done'; bytes: number; missing: number };

/** Saves every recording of some units and sheets for offline use. Give it a `key` per screen so it starts over. */
export function AudioDownload({ units = [], sheets = [] }: { units?: readonly string[]; sheets?: readonly string[] }) {
  const scopeKey = JSON.stringify([units, sheets]);
  const texts = useMemo(() => {
    const [u, s] = JSON.parse(scopeKey) as [string[], string[]];
    const scope: AudioScope = { units: new Set(u), sheets: new Set(s) };
    return collectAudioTexts(content, scope).map((t) => t.text);
  }, [scopeKey]);
  const [state, setState] = useState<State>({ kind: 'checking' });

  // Only the cache is read here: nothing is fetched until the learner asks for it.
  useEffect(() => {
    let live = true;
    void Promise.all(texts.map(isCached)).then((hits) => {
      if (!live) return;
      const cached = hits.filter(Boolean).length;
      if (cached && cached === texts.length) void run(() => live);
      else setState({ kind: 'idle', cached });
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run is recreated each render; texts decides
  }, [texts]);

  async function run(live: () => boolean) {
    const result = await downloadAll(texts, deps, (progress) => setState({ kind: 'loading', progress }), live);
    if (!live()) return;
    setState(result.interrupted ? { kind: 'interrupted', cached: result.done - result.missing } : { kind: 'done', bytes: result.bytes, missing: result.missing });
  }

  if (!texts.length || state.kind === 'checking') return null;
  return (
    <div className="audio-download">
      {(state.kind === 'idle' || state.kind === 'interrupted') && (
        <>
          <button className="button" onClick={() => void run(() => true)}>
            <Icon name="download" /> {state.cached ? ui.resumeAudio : ui.downloadAudio}
          </button>
          {state.kind === 'interrupted' && <span className="muted small">{ui.audioInterrupted}</span>}
          {state.cached > 0 && <span className="muted small">{ui.audioAlready(state.cached, texts.length)}</span>}
        </>
      )}
      {state.kind === 'loading' && (
        <span className="muted small">
          {ui.downloadingAudio(state.progress.done, state.progress.total)}
          {state.progress.waitSeconds ? ` · ${ui.audioRetryIn(state.progress.waitSeconds)}` : ''}
        </span>
      )}
      {state.kind === 'done' && (
        <>
          <span className="muted small">{ui.audioReady(ui.fileSize(state.bytes))}</span>
          {state.missing > 0 && <span className="muted small">{ui.audioPartly(state.missing)}</span>}
        </>
      )}
    </div>
  );
}
