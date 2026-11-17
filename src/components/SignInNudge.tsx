import { useState } from 'react';
import { ui } from '../i18n/ui';
import { signInUrl } from '../lib/account';
import { useAccountStore } from '../state/accountStore';
import { nudgeSnoozed, snoozeNudge } from '../state/signInNudge';

/** On the home screen, for learners who never open Réglages: without an account, progress lives on this device only. */
export function SignInNudge() {
  const signedOut = useAccountStore((s) => s.account?.status === 'signedOut');
  const [snoozed, setSnoozed] = useState(() => nudgeSnoozed(new Date()));
  const [polish, setPolish] = useState(false);
  if (!signedOut || snoozed) return null;

  const later = () => {
    snoozeNudge(new Date());
    setSnoozed(true);
  };

  return (
    <section className="signin-nudge" aria-labelledby="signin-nudge-title">
      <h2 id="signin-nudge-title">{ui.signInNudgeTitle}</h2>
      <p>{ui.signInNudge}</p>
      {polish && (
        <p className="muted" lang="pl">
          <strong>{ui.signInNudgeTitlePl}</strong> {ui.signInNudgePl}
        </p>
      )}
      <div className="signin-nudge-actions">
        <a className="button primary" href={signInUrl(`${window.location.origin}${import.meta.env.BASE_URL}`)}>
          {ui.signInGoogle}
        </a>
        <button className="button secondary" onClick={later}>
          {ui.later}
        </button>
        <button className="link-button" aria-expanded={polish} onClick={() => setPolish((p) => !p)}>
          {polish ? ui.hideTranslation : ui.inPolish}
        </button>
      </div>
    </section>
  );
}
