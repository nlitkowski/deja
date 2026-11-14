import { useRegisterSW } from 'virtual:pwa-register/react';
import { ui } from '../i18n/ui';

/** Offers a new version instead of reloading on its own, so a session is never cut short. */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="update-toast" role="status">
      <span>{ui.newVersion}</span>
      <button className="link-button" onClick={() => void updateServiceWorker(true)}>
        {ui.reload}
      </button>
    </div>
  );
}
