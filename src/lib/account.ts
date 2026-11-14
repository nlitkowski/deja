/** Unavailable: no API behind this deployment (e.g. GitHub Pages) or offline; the app then simply stays local. */
export type Account = { status: 'unavailable' } | { status: 'signedOut' } | { status: 'signedIn'; email: string };

export type SignInResult = 'connected' | 'cancelled' | 'error';

const api = (path: string) => `${import.meta.env.BASE_URL}api${path}`;

/** A full-page navigation, not fetch: the Worker redirects to Google and back. */
export const signInUrl = () => api('/auth/google');

export async function fetchAccount(fetcher: typeof fetch = fetch): Promise<Account> {
  try {
    const res = await fetcher(api('/me'), { credentials: 'same-origin' });
    if (res.status === 401) return { status: 'signedOut' };
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return { status: 'unavailable' };
    const body = (await res.json()) as { email?: unknown };
    return typeof body.email === 'string' ? { status: 'signedIn', email: body.email } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function signOut(fetcher: typeof fetch = fetch): Promise<void> {
  await fetcher(api('/auth/logout'), { method: 'POST', credentials: 'same-origin' });
}

/** Reads and strips the `?account=` result the Worker appends after sign-in, so a reload doesn't show it again. */
export function takeSignInResult(location: Location, history: History): SignInResult | null {
  const params = new URLSearchParams(location.search);
  const result = params.get('account');
  if (!result) return null;
  params.delete('account');
  const query = params.toString();
  history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  return result === 'connected' || result === 'cancelled' ? result : 'error';
}
