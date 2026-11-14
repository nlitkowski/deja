import { useEffect, useState } from 'react';
import { ui } from '../i18n/ui';
import { signInUrl } from '../lib/account';
import { useAccountStore } from '../state/accountStore';

/** Hidden where there is no API behind the app (GitHub Pages, offline): the app then just stays local. */
export function AccountCard() {
  const account = useAccountStore((s) => s.account);
  const result = useAccountStore((s) => s.signInResult);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void useAccountStore.getState().refresh();
  }, []);

  if (!account || account.status === 'unavailable') return null;

  const signedIn = account.status === 'signedIn';
  // A stale result (e.g. "connected" after signing out in another tab) would contradict what the card shows.
  const message = result === 'connected' ? signedIn : result !== null && !signedIn;

  const leave = async () => {
    setBusy(true);
    try {
      await useAccountStore.getState().signOut();
    } finally {
      setBusy(false);
    }
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
          <p className="muted small">{ui.syncSoon}</p>
          <button className="button secondary" onClick={leave} disabled={busy}>
            {ui.signOut}
          </button>
        </>
      ) : (
        <>
          <p className="muted small">{ui.accountHint}</p>
          <a className="button primary" href={signInUrl()}>
            {ui.signInGoogle}
          </a>
        </>
      )}
    </section>
  );
}
