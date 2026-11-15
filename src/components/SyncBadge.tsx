import { useEffect, useState } from 'react';
import { ui } from '../i18n/ui';
import { useSyncStore } from '../state/sync';
import { Icon } from './Icon';

const NOTE_MS = 4000;

/**
 * A small cloud in the header while signed in; its dot tells whether everything has reached the server.
 * The dot alone is hard to read on a phone, so a tap spells the state out for a few seconds.
 */
export function SyncBadge() {
  const { status, pending } = useSyncStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpen(false), NOTE_MS);
    return () => window.clearTimeout(timer);
  }, [open, status]);

  if (status === 'off') return null;
  const label = ui.syncState(status, pending);
  return (
    <span className="sync-badge-wrap">
      <button type="button" className={`sync-badge ${status}`} aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="cloud" />
      </button>
      {open && (
        <span className="sync-note small" role="status">
          {ui.syncShort(status, pending)}
        </span>
      )}
    </span>
  );
}
