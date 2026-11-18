import config from '../../content/_audio/config.json';
import kept from '../../content/_audio/kept-voices.json';
import type { AudioConfig } from './manifest';

/** The audio config with the voices kept for earlier recordings, as the app and the tests see it. */
export const audioConfig: AudioConfig = { ...config, kept };
