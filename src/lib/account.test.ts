import { describe, expect, it, vi } from 'vitest';
import { fetchAccount, takeSignInResult } from './account';

const reply = (status: number, body: unknown, type = 'application/json') => async () =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type } });

const API = 'https://deja-api.test';

describe('fetchAccount', () => {
  it('is unavailable without an API address, without asking anything', async () => {
    const fetcher = vi.fn();
    expect(await fetchAccount(fetcher, '')).toEqual({ status: 'unavailable' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends the session cookie to the API on its own subdomain', async () => {
    const fetcher = vi.fn(reply(401, {}));
    await fetchAccount(fetcher, API);
    expect(fetcher).toHaveBeenCalledWith(`${API}/me`, { credentials: 'include' });
  });

  it('reads the signed-in email', async () => {
    expect(await fetchAccount(reply(200, { email: 'a@example.com' }), API)).toEqual({ status: 'signedIn', email: 'a@example.com' });
  });

  it('is signed out on 401', async () => {
    expect(await fetchAccount(reply(401, { error: 'unauthenticated' }), API)).toEqual({ status: 'signedOut' });
  });

  it('is unavailable without an API: an HTML 404 page, a network error', async () => {
    expect(await fetchAccount(reply(404, '<html></html>', 'text/html'), API)).toEqual({ status: 'unavailable' });
    expect(await fetchAccount(reply(200, '<html></html>', 'text/html'), API)).toEqual({ status: 'unavailable' });
    expect(
      await fetchAccount(async () => {
        throw new TypeError('offline');
      }, API),
    ).toEqual({ status: 'unavailable' });
  });
});

describe('takeSignInResult', () => {
  it('returns the result and removes it from the address, keeping the rest', () => {
    const history = { state: null, replaceState: vi.fn() } as unknown as History;
    const location = { search: '?account=connected&x=1', pathname: '/', hash: '' } as Location;
    expect(takeSignInResult(location, history)).toBe('connected');
    expect(history.replaceState).toHaveBeenCalledWith(null, '', '/?x=1');
  });

  it('treats anything unexpected as an error and does nothing without the parameter', () => {
    const history = { state: null, replaceState: vi.fn() } as unknown as History;
    expect(takeSignInResult({ search: '?account=weird', pathname: '/', hash: '' } as Location, history)).toBe('error');
    expect(takeSignInResult({ search: '', pathname: '/', hash: '' } as Location, history)).toBeNull();
  });
});
