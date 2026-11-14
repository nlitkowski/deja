import { useRef, useState, type ChangeEvent } from 'react';
import { ui } from '../i18n/ui';
import { backupFileName, createBackup, parseBackup } from '../lib/backup';
import { dayKey } from '../lib/date';
import { useAppStore } from '../state/appStore';

type Status = { kind: 'ok' | 'error'; text: string } | null;

export function BackupCard() {
  const ready = useAppStore((s) => s.status === 'ready');
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const download = () => {
    const { log, settings } = useAppStore.getState();
    const now = new Date();
    const blob = new Blob([JSON.stringify(createBackup(log, settings, now))], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName(dayKey(now));
    link.click();
    URL.revokeObjectURL(url);
    setStatus({ kind: 'ok', text: ui.backupExported(log.length) });
  };

  const restore = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        setStatus({ kind: 'error', text: ui.backupInvalid[parsed.reason] });
        return;
      }
      const added = await useAppStore.getState().importBackup(parsed.events, parsed.settings);
      setStatus({ kind: 'ok', text: ui.backupImported(added) });
    } catch (error) {
      console.error('Déjà: backup import failed', error);
      setStatus({ kind: 'error', text: ui.backupSaveFailed });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-card backup-card">
      <h2>{ui.backup}</h2>
      <p className="muted small">{ui.backupHint}</p>
      <div className="backup-actions">
        <button className="button secondary" onClick={download} disabled={!ready}>
          {ui.backupExport}
        </button>
        <button className="button secondary" onClick={() => input.current?.click()} disabled={!ready || busy}>
          {ui.backupImport}
        </button>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={restore} />
      </div>
      {status && (
        <p className={`account-result ${status.kind === 'ok' ? 'connected' : 'error'}`} role="status">
          {status.text}
        </p>
      )}
    </section>
  );
}
