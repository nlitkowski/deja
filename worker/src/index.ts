import { createRemoteJWKSet } from 'jose';
import { createApp } from './app';

// Module scope, so Google's signing keys are fetched once per isolate and cached by jose.
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export default createApp({ googleKeys, fetch: (input, init) => fetch(input, init), now: () => new Date() });
