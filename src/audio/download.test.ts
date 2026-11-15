import { afterEach, describe, expect, it, vi } from 'vitest';
import { DOWNLOAD, downloadAll, type DownloadDeps, type DownloadProgress } from './download';

const blob = (size: number) => new Blob([new Uint8Array(size)]);
const httpError = (status: number) => Object.assign(new Error(String(status)), { status });

function fakeDeps({ cached = [] as string[], fail = {} as Record<string, number[]> } = {}) {
  let inFlight = 0;
  const calls: string[] = [];
  const sleeps: number[] = [];
  const stats = { maxInFlight: 0 };
  const deps: DownloadDeps = {
    isCached: async (t) => cached.includes(t),
    cachedSize: async () => 7,
    sleep: async (ms) => void sleeps.push(ms),
    fetchAudio: async (t) => {
      calls.push(t);
      inFlight += 1;
      stats.maxInFlight = Math.max(stats.maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      const status = fail[t]?.shift();
      if (status) throw httpError(status);
      return blob(10);
    },
  };
  return { deps, calls, sleeps, stats };
}

const texts = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);

describe('downloadAll', () => {
  it('never runs more than the parallel limit at once', async () => {
    const { deps, calls, stats } = fakeDeps();
    const result = await downloadAll(texts(20), deps);
    expect(calls).toHaveLength(20);
    expect(stats.maxInFlight).toBe(DOWNLOAD.parallel);
    expect(result).toMatchObject({ done: 20, total: 20, bytes: 200, missing: 0, interrupted: false });
  });

  it('skips what is already cached, counting it as done: an interrupted download resumes', async () => {
    const { deps, calls } = fakeDeps({ cached: ['t0', 't1', 't2'] });
    const progress: DownloadProgress[] = [];
    const result = await downloadAll(texts(5), deps, (p) => progress.push(p));
    expect(calls.sort()).toEqual(['t3', 't4']);
    expect(progress[0]).toMatchObject({ done: 3, total: 5, bytes: 21 });
    expect(result).toMatchObject({ done: 5, bytes: 41 });
  });

  it('waits out a 429 with a growing pause, then picks up the same file', async () => {
    const { deps, calls, sleeps } = fakeDeps({ fail: { t0: [429, 429] } });
    const progress: DownloadProgress[] = [];
    const result = await downloadAll(['t0'], deps, (p) => progress.push(p));
    expect(calls).toEqual(['t0', 't0', 't0']);
    expect(sleeps).toEqual([1000, 1000, 1000]);
    expect(progress.map((p) => p.waitSeconds).filter(Boolean)).toEqual([1, 2, 1]);
    expect(result).toMatchObject({ done: 1, missing: 0, interrupted: false });
  });

  it('gives up for now after too many rate limits in a row, leaving the rest for later', async () => {
    const { deps } = fakeDeps({ fail: { t0: Array(20).fill(429) } });
    const result = await downloadAll(['t0', 't1'], deps);
    expect(result.interrupted).toBe(true);
    expect(result.done).toBeLessThan(2);
  });

  it('counts a missing recording once and does not ask for it again', async () => {
    const { deps, calls } = fakeDeps({ fail: { t1: [404] } });
    const result = await downloadAll(texts(3), deps);
    expect(calls.filter((t) => t === 't1')).toHaveLength(1);
    expect(result).toMatchObject({ done: 3, missing: 1 });
  });

  it('stops when the screen is left', async () => {
    const { deps, calls } = fakeDeps();
    let live = true;
    const progress: DownloadProgress[] = [];
    await downloadAll(texts(40), deps, (p) => {
      progress.push(p);
      if (p.done >= 4) live = false;
    }, () => live);
    expect(calls.length).toBeLessThan(40);
  });
});

describe('fetchAudio', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not ask again for a recording that returned 404', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchAudio } = await import('./player');
    await expect(fetchAudio('Il n’existe pas.')).rejects.toMatchObject({ status: 404 });
    await expect(fetchAudio('Il n’existe pas.')).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks again after another error, which may be passing', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const { fetchAudio } = await import('./player');
    await expect(fetchAudio('Réessaie.')).rejects.toMatchObject({ status: 503 });
    await expect(fetchAudio('Réessaie.')).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
