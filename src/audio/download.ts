/** Downloading many recordings without tripping the edge's rate limit; no React, no browser APIs. */

export interface DownloadDeps {
  /** Rejects with `{ status }` on an HTTP error. */
  fetchAudio: (text: string) => Promise<Blob>;
  isCached: (text: string) => Promise<boolean>;
  /** Size of a recording already in the cache. */
  cachedSize: (text: string) => Promise<number>;
  sleep: (ms: number) => Promise<void>;
}

export interface DownloadProgress {
  done: number;
  total: number;
  bytes: number;
  /** No recording (404) or another error: skipped, not retried. */
  missing: number;
  /** Rate limited: seconds before the download resumes. */
  waitSeconds?: number;
}

export interface DownloadResult extends DownloadProgress {
  /** Stopped after too many rate limits in a row; downloading again resumes from the cache. */
  interrupted: boolean;
}

export const DOWNLOAD = {
  parallel: 4,
  /** Pause after a 429, doubling each time in a row: 1 s, 2 s, 4 s… up to the cap. */
  backoffMs: 1000,
  maxBackoffMs: 30_000,
  /** Rate limits in a row before giving up for now. */
  maxRateLimits: 8,
} as const;

const statusOf = (error: unknown) => (error as { status?: number } | null)?.status;

export async function downloadAll(
  texts: readonly string[],
  deps: DownloadDeps,
  onProgress: (p: DownloadProgress) => void = () => {},
  live: () => boolean = () => true,
): Promise<DownloadResult> {
  const p: DownloadProgress = { done: 0, total: texts.length, bytes: 0, missing: 0 };
  const report = () => live() && onProgress({ ...p });

  const queue: string[] = [];
  for (const text of texts) {
    if (await deps.isCached(text)) {
      p.done += 1;
      const size = await deps.cachedSize(text);
      p.bytes += size;
    } else queue.push(text);
  }
  report();

  let rateLimits = 0;
  let pause: Promise<void> | undefined;
  let interrupted = false;

  async function backOff() {
    rateLimits += 1;
    if (rateLimits > DOWNLOAD.maxRateLimits) {
      interrupted = true;
      return;
    }
    const seconds = Math.min(DOWNLOAD.backoffMs * 2 ** (rateLimits - 1), DOWNLOAD.maxBackoffMs) / 1000;
    for (let left = seconds; left > 0 && live(); left--) {
      p.waitSeconds = left;
      report();
      await deps.sleep(1000);
    }
    p.waitSeconds = undefined;
    report();
  }

  async function worker() {
    while (queue.length && live() && !interrupted) {
      if (pause) {
        await pause;
        continue;
      }
      const text = queue.shift()!;
      try {
        // Awaited first: `p.bytes += await …` would read the total before the wait and lose the other workers' sizes.
        const { size } = await deps.fetchAudio(text);
        p.bytes += size;
        p.done += 1;
        rateLimits = 0;
      } catch (error) {
        if (statusOf(error) === 429) {
          // Back in line where it was; every worker waits out the same pause.
          queue.unshift(text);
          pause ??= backOff().finally(() => (pause = undefined));
          continue;
        }
        p.done += 1;
        p.missing += 1;
      }
      report();
    }
  }

  await Promise.all(Array.from({ length: DOWNLOAD.parallel }, worker));
  return { ...p, interrupted };
}
