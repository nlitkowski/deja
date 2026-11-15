import { useSyncExternalStore } from 'react';
import config from '../../content/_audio/config.json';
import { audioKeyAsync, type AudioConfig } from './manifest';

/**
 * Plays recorded sentences. Files are fetched (CORS) and kept in the Cache API, then played from a blob:
 * that works offline, and avoids caching the opaque range responses an <audio src> on another origin makes.
 */
const CACHE = 'deja-audio';
const SLOW_RATE = 0.75;

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (text: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

const urls = new Map<string, Promise<string>>();

export function audioUrl(text: string): Promise<string> {
  let url = urls.get(text);
  if (!url) urls.set(text, (url = audioKeyAsync(config as AudioConfig, text, sha256).then((key) => `${config.baseUrl}/${key}.mp3`)));
  return url;
}

async function openCache(): Promise<Cache | undefined> {
  try {
    return 'caches' in globalThis ? await caches.open(CACHE) : undefined;
  } catch {
    return undefined;
  }
}

export async function isCached(text: string): Promise<boolean> {
  return !!(await (await openCache())?.match(await audioUrl(text)));
}

/** Texts whose recording does not exist (404): never asked for again until the app reloads. */
const absent = new Set<string>();

const httpError = (status: number) => Object.assign(new Error(`audio ${status}`), { status });

/** The recording, from the cache or the network (then cached). */
export async function fetchAudio(text: string): Promise<Blob> {
  if (absent.has(text)) throw httpError(404);
  const url = await audioUrl(text);
  const cache = await openCache();
  const hit = await cache?.match(url);
  if (hit) return hit.blob();
  const res = await fetch(url, { mode: 'cors' });
  if (res.status === 404) absent.add(text);
  if (!res.ok) throw httpError(res.status);
  await cache?.put(url, res.clone()).catch(() => undefined);
  return res.blob();
}

export async function cachedSize(text: string): Promise<number> {
  const hit = await (await openCache())?.match(await audioUrl(text));
  return Number(hit?.headers.get('content-length')) || (await hit?.blob())?.size || 0;
}

export async function cachedBytes(): Promise<number> {
  const cache = await openCache();
  if (!cache) return 0;
  let total = 0;
  for (const req of await cache.keys()) total += Number((await cache.match(req))?.headers.get('content-length')) || 0;
  return total;
}

export async function hasCachedAudio(): Promise<boolean> {
  return ((await (await openCache())?.keys())?.length ?? 0) > 0;
}

export async function clearCache(): Promise<void> {
  if ('caches' in globalThis) await caches.delete(CACHE).catch(() => false);
}

export type PlayStatus = 'loading' | 'playing';

interface PlayerState {
  text: string | null;
  status: PlayStatus | null;
  /** Texts that could not be played: no recording, or no network and not cached. */
  failed: ReadonlySet<string>;
}

let state: PlayerState = { text: null, status: null, failed: new Set() };
const listeners = new Set<() => void>();
const setState = (next: Partial<PlayerState>) => {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
};

let element: HTMLAudioElement | undefined;
let objectUrl: string | undefined;
let request = 0;

function audioElement(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.addEventListener('ended', () => setState({ text: null, status: null }));
  }
  return element;
}

// Silent WAV: iOS only lets an element play without a gesture after it once played during one.
function silentWav(): string {
  const samples = 800;
  const view = new DataView(new ArrayBuffer(44 + samples));
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, 'data');
  view.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) view.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([view.buffer], { type: 'audio/wav' }));
}

/** Call once at startup: the first tap anywhere unlocks playback for the rest of the visit. */
export function unlockOnFirstGesture(): void {
  if (typeof document === 'undefined') return;
  const unlock = () => {
    const el = audioElement();
    if (!el.src) {
      el.src = silentWav();
      el.play().catch(() => undefined);
    }
  };
  document.addEventListener('pointerdown', unlock, { once: true, capture: true });
  document.addEventListener('keydown', unlock, { once: true, capture: true });
  // A failure without network is not final: try again once it is back.
  window.addEventListener('online', () => setState({ failed: new Set() }));
}

export function stop(): void {
  request += 1;
  element?.pause();
  setState({ text: null, status: null });
}

export async function play(text: string, { slow = false } = {}): Promise<void> {
  stop();
  const mine = request;
  setState({ text, status: 'loading' });
  let blob: Blob;
  try {
    blob = await fetchAudio(text);
  } catch {
    if (mine === request) setState({ text: null, status: null, failed: new Set(state.failed).add(text) });
    return;
  }
  if (mine !== request) return;
  const el = audioElement();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  el.src = objectUrl = URL.createObjectURL(blob);
  el.defaultPlaybackRate = el.playbackRate = slow ? SLOW_RATE : 1;
  el.preservesPitch = true;
  try {
    await el.play();
    if (mine === request) setState({ status: 'playing' });
  } catch {
    // Blocked without a gesture (automatic reading): the button still plays it.
    if (mine === request) setState({ text: null, status: null });
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const usePlayer = () => useSyncExternalStore(subscribe, () => state);
