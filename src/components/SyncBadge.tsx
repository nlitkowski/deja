import { ui } from '../i18n/ui';
import { useSyncStore } from '../state/sync';
import { Icon } from './Icon';

/** A small cloud in the header while signed in; its dot tells whether everything has reached the server. */
export function SyncBadge() {
  const { status, pending } = useSyncStore();
  if (status === 'off') return null;
  const label = ui.syncState(status, pending);
  return (
    <span className={`sync-badge ${status}`} role="img" aria-label={label} title={label}>
      <Icon name="cloud" />
    </span>
  );
}
