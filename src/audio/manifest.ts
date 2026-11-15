/** `content/_audio/config.json`: who reads the recordings. */
export interface AudioConfig {
  provider: string;
  lang: string;
  /** R2 bucket holding `<key>.mp3`, served from `baseUrl`. */
  bucket: string;
  baseUrl: string;
  /** Provider's output format, e.g. Azure's `audio-24khz-48kbitrate-mono-mp3`. */
  format: string;
  /** Voices taking turns by the text's hash; empty until voices are chosen. */
  voices: string[];
}

export interface ManifestItem {
  text: string;
  voice: string;
  bytes: number;
}

/** `content/_audio/manifest.json`: every recording in the bucket, by key (its file is `<key>.mp3`). */
export type Manifest = Record<string, ManifestItem>;

/** Hex SHA-256. Node hashes synchronously, the browser (SubtleCrypto) only asynchronously. */
export type Sha256 = (text: string) => string;
export type AsyncSha256 = (text: string) => Promise<string>;

/** A sentence always gets the same voice, and the voices alternate across sentences. */
const pickVoice = (config: AudioConfig, textHash: string): string => {
  if (!config.voices.length) throw new Error('content/_audio/config.json: no voices chosen yet');
  return config.voices[parseInt(textHash.slice(0, 8), 16) % config.voices.length]!;
};

const keyInput = (provider: string, voice: string, text: string) => `${provider}\n${voice}\n${text}`;

export const voiceFor = (config: AudioConfig, text: string, sha256: Sha256): string => pickVoice(config, sha256(text));

/** Changing the text, the voice or the provider gives a new key, so files never need overwriting. */
export const audioKey = (provider: string, voice: string, text: string, sha256: Sha256): string => sha256(keyInput(provider, voice, text)).slice(0, 32);

/** The recording's key, computed the same way in the browser. */
export async function audioKeyAsync(config: AudioConfig, text: string, sha256: AsyncSha256): Promise<string> {
  const voice = pickVoice(config, await sha256(text));
  return (await sha256(keyInput(config.provider, voice, text))).slice(0, 32);
}
