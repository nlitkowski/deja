import { create } from 'zustand';
import { fetchAccount, signOut, takeSignInResult, type Account, type SignInResult } from '../lib/account';

interface AccountStore {
  /** null while the first check is in flight. */
  account: Account | null;
  /** How the last sign-in went, read from the address once on start. */
  signInResult: SignInResult | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAccountStore = create<AccountStore>((set) => ({
  account: null,
  signInResult: typeof window === 'undefined' ? null : takeSignInResult(window.location, window.history),
  async refresh() {
    set({ account: await fetchAccount() });
  },
  async signOut() {
    await signOut();
    set({ account: { status: 'signedOut' }, signInResult: null });
  },
}));
