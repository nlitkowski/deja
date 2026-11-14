import { create } from 'zustand';
import { fetchAccount, signOut, takeSignInResult, type Account, type SignInResult } from '../lib/account';
import { browserStore } from '../lib/storage';

interface AccountStore {
  /** null while the first check is in flight. */
  account: Account | null;
  /** How the last sign-in went, read from the address once on start. */
  signInResult: SignInResult | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const ACCOUNT_KEY = 'deja:account';
type Known = Extract<Account, { status: 'signedIn' }>;

/** The last signed-in account, so an app opened offline still knows whose progress it is queueing. */
function remembered(): Known | null {
  try {
    const raw = browserStore()?.getItem(ACCOUNT_KEY);
    const value = raw ? (JSON.parse(raw) as Partial<Known>) : null;
    return value && typeof value.id === 'string' && typeof value.email === 'string' ? { status: 'signedIn', id: value.id, email: value.email } : null;
  } catch {
    return null;
  }
}

function remember(account: Known | null) {
  try {
    if (account) browserStore()?.setItem(ACCOUNT_KEY, JSON.stringify({ id: account.id, email: account.email }));
    else browserStore()?.removeItem(ACCOUNT_KEY);
  } catch {
    // Storage blocked: the account is then only known while the API answers.
  }
}

export const useAccountStore = create<AccountStore>((set, get) => ({
  account: remembered(),
  signInResult: typeof window === 'undefined' ? null : takeSignInResult(window.location, window.history),
  async refresh() {
    const next = await fetchAccount();
    // Unreachable is not signed out: keep the account, and sync reports being offline instead.
    if (next.status === 'unavailable' && get().account?.status === 'signedIn') return;
    if (next.status === 'signedIn') remember(next);
    else if (next.status === 'signedOut') remember(null);
    set({ account: next });
  },
  async signOut() {
    await signOut();
    remember(null);
    set({ account: { status: 'signedOut' }, signInResult: null });
  },
}));
