/** Cloudflare's purge by URL takes at most this many files per call. */
const BATCH = 30;

/** Drops deleted recordings from the edge cache, which would otherwise serve them for up to its TTL. */
export async function purgeUrls({ zoneId, token }: { zoneId: string; token: string }, urls: readonly string[]): Promise<void> {
  for (let i = 0; i < urls.length; i += BATCH) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: urls.slice(i, i + BATCH) }),
    });
    if (!res.ok) throw new Error(`purge ${res.status}: ${await res.text()}`);
  }
}
