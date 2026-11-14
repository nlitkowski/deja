const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const randomToken = (bytes = 32) => base64url(crypto.getRandomValues(new Uint8Array(bytes)));

export async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}

export const sha256Hex = async (text: string) => [...(await sha256(text))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** PKCE S256 challenge for a code verifier (RFC 7636). */
export const pkceChallenge = async (verifier: string) => base64url(await sha256(verifier));
