import { useEffect, useState } from 'react';
import { ui } from '../i18n/ui';
import { signInUrl } from '../lib/account';
import { useAccountStore } from '../state/accountStore';
import { flushBeforeSignOut, signOutAndClear, useSyncStore } from '../state/sync';
import { downloadBackup } from './BackupCard';

type Leaving = { step: 'idle' } | { step: 'busy' } | { step: 'unsent'; pending: number } | { step: 'offline' };

/** Hidden when the build has no API or the API is unreachable: the app then just stays local. */
export function AccountCard() {
  const account = useAccountStore((s) => s.account);
  const result = useAccountStore((s) => s.signInResult);
  const sync = useSyncStore();
  const [leaving, setLeaving] = useState<Leaving>({ step: 'idle' });

  useEffect(() => {
    void useAccountStore.getState().refresh();
  }, []);

  if (!account || account.status === 'unavailable') return null;

  const signedIn = account.status === 'signedIn';
  // A stale result (e.g. "connected" after signing out in another tab) would contradict what the card shows.
  const message = result === 'connected' ? signedIn : result !== null && !signedIn;

  const finish = async () => {
    setLeaving({ step: 'busy' });
    setLeaving((await signOutAndClear()) ? { step: 'idle' } : { step: 'offline' });
  };

  const leave = async () => {
    setLeaving({ step: 'busy' });
    const pending = await flushBeforeSignOut();
    if (pending) setLeaving({ step: 'unsent', pending });
    else await finish();
  };

  return (
    <section className="settings-card account-card">
      <h2>{ui.account}</h2>
      {message && result && (
        <p className={`account-result ${result}`} role="status">
          {ui.signInResult[result]}
        </p>
      )}
      {account.status === 'signedIn' ? (
        <>
          <p>{ui.signedInAs(account.email)}</p>
          {sync.status !== 'off' && (
            <p className={`sync-line ${sync.status}`} role="status">
              {ui.syncState(sync.status, sync.pending)}
            </p>
          )}
          {leaving.step === 'unsent' ? (
            <div className="account-result error" role="alert">
              <p>{ui.unsentWarning(leaving.pending)}</p>
              <div className="backup-actions">
                <button className="button secondary" onClick={downloadBackup}>
                  {ui.backupExport}
                </button>
                <button className="button secondary" onClick={finish}>
                  {ui.signOutAnyway}
                </button>
                <button className="button secondary" onClick={() => setLeaving({ step: 'idle' })}>
                  {ui.cancel}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="muted small">{ui.signOutHint}</p>
              <button className="button secondary" onClick={leave} disabled={leaving.step === 'busy'}>
                {ui.signOut}
              </button>
            </>
          )}
          {leaving.step === 'offline' && (
            <p className="account-result error" role="alert">
              {ui.signOutOffline}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="muted small">{ui.accountHint}</p>
          <a className="button primary" href={signInUrl(`${window.location.origin}${import.meta.env.BASE_URL}`)}>
            {ui.signInGoogle}
          </a>
        </>
      )}
    </section>
  );
}
