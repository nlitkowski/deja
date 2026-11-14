/** Unavailable: no API configured for this build, or offline; the app then simply stays local. */
export type Account = { status: 'unavailable' } | { status: 'signedOut' } | { status: 'signedIn'; id: string; email: string };

export type SignInResult = 'connected' | 'cancelled' | 'error';

/** The API's origin (VITE_API_URL at build time), e.g. https://deja-api.litkowski.com; empty = no account features. */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const api = (path: string) => `${API_URL}${path}`;

/** A full-page navigation, not fetch: the Worker redirects to Google and back to this page. */
export const signInUrl = (appUrl: string) => api(`/auth/google?return=${encodeURIComponent(appUrl)}`);

export async function fetchAccount(fetcher: typeof fetch = fetch, apiUrl = API_URL): Promise<Account> {
  if (!apiUrl) return { status: 'unavailable' };
  try {
    // `include`: the API is on another subdomain, and the session cookie must travel with the request.
    const res = await fetcher(`${apiUrl}/me`, { credentials: 'include' });
    if (res.status === 401) return { status: 'signedOut' };
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return { status: 'unavailable' };
    const body = (await res.json()) as { id?: unknown; email?: unknown };
    return typeof body.email === 'string' && typeof body.id === 'string' ? { status: 'signedIn', id: body.id, email: body.email } : { status: 'unavailable' };
  } catch {
    return { status: 'unavailable' };
  }
}

/** Throws when the API cannot be reached: the session cookie can only be cleared by the server. */
export async function signOut(fetcher: typeof fetch = fetch): Promise<void> {
  const res = await fetcher(api('/auth/logout'), { method: 'POST', credentials: 'include' });
  if (!res.ok) throw new Error(`sign-out failed: ${res.status}`);
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
