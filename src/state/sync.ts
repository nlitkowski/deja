import { create } from 'zustand';
import { API_URL, deleteAccount } from '../lib/account';
import { httpSyncApi, SyncEngine, type SyncStatus } from '../lib/progress/sync';
import { useAccountStore } from './accountStore';
import { useAppStore } from './appStore';
import { localStore, onAppend } from './localStore';

interface SyncState {
  status: SyncStatus;
  /** Events waiting in the outbox. */
  pending: number;
}

export const useSyncStore = create<SyncState>(() => ({ status: 'off', pending: 0 }));

const engine = API_URL
  ? new SyncEngine(localStore, httpSyncApi(API_URL), {
      onPulled: (events) => useAppStore.getState().receive(events),
      onStatus: (status, pending) => useSyncStore.setState({ status, pending }),
      onSignedOut: () => void useAccountStore.getState().refresh(),
      settings: { get: () => useAppStore.getState().stampedSettings(), apply: (merged) => useAppStore.getState().applyRemoteSettings(merged) },
    })
  : undefined;

let syncedUser: string | undefined;

/** Starts syncing whenever an account is signed in. Without an API (no VITE_API_URL) the app stays local. */
export function startSync() {
  if (!engine) return;
  onAppend(() => engine.syncSoon());
  useAppStore.subscribe((state, previous) => {
    if (state.settings !== previous.settings) engine.syncSoon();
  });

  // Also run for the current state: an account remembered from last time is signed in from the start.
  const follow = ({ account }: { account: ReturnType<typeof useAccountStore.getState>['account'] }) => {
    if (account?.status === 'signedIn') {
      if (syncedUser === account.id) return;
      syncedUser = account.id;
      void engine.start(account.id);
    } else if (account && syncedUser) {
      // Signed out or unreachable: stop, but keep the local log; it is only cleared by signing out here.
      syncedUser = undefined;
      engine.stop();
    }
  };
  follow(useAccountStore.getState());
  useAccountStore.subscribe(follow);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    void useAccountStore.getState().refresh();
    void engine.sync();
  });
  window.addEventListener('online', () => void engine.sync());
  void useAccountStore.getState().refresh();
}

/** Sends what it can before signing out; resolves to what is still unsent. */
export async function flushBeforeSignOut(): Promise<number> {
  if (engine?.signedIn) await engine.sync();
  return engine?.signedIn ? localStore.outboxSize() : 0;
}

/**
 * Ends the session, then removes this account's progress from the device so the next person starts
 * clean. Resolves false when the server cannot be reached: nothing is cleared then.
 */
export async function signOutAndClear(): Promise<boolean> {
  try {
    await useAccountStore.getState().signOut();
  } catch {
    return false;
  }
  syncedUser = undefined;
  engine?.stop();
  await localStore.clear();
  useAppStore.getState().resetLog();
  return true;
}

/**
 * Deletes the account on the server. The progress on this device stays, now unlinked from any account,
 * so a future sign-in sends it again. Resolves false when the server could not be reached or refused.
 */
export async function deleteAccountKeepLocal(): Promise<boolean> {
  try {
    await deleteAccount();
  } catch {
    return false;
  }
  syncedUser = undefined;
  engine?.stop();
  await localStore.setMeta({ cursor: 0 });
  await useAccountStore.getState().refresh();
  return true;
}

