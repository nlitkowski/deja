import { AwsClient } from 'aws4fetch';

/** The bucket through R2's S3-compatible API. */
export function r2Bucket({ accountId, accessKeyId, secretAccessKey, bucket }: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }) {
  const client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;

  async function check(res: Response, what: string) {
    if (!res.ok) throw new Error(`R2 ${what} ${res.status}: ${await res.text()}`);
    return res;
  }

  return {
    async put(name: string, body: ArrayBuffer, contentType: string) {
      await check(
        await client.fetch(`${base}/${encodeURIComponent(name)}`, {
          method: 'PUT',
          body,
          // Files are named by the hash of what they contain, so they never change.
          headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
        }),
        `put ${name}`,
      );
    },

    async delete(name: string) {
      await check(await client.fetch(`${base}/${encodeURIComponent(name)}`, { method: 'DELETE' }), `delete ${name}`);
    },

    async list(): Promise<string[]> {
      const names: string[] = [];
      let token: string | undefined;
      do {
        const query = new URLSearchParams({ 'list-type': '2', ...(token ? { 'continuation-token': token } : {}) });
        const xml = await (await check(await client.fetch(`${base}?${query}`), 'list')).text();
        for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) names.push(m[1]!);
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? /<NextContinuationToken>([^<]+)</.exec(xml)?.[1] : undefined;
      } while (token);
      return names;
    },
  };
}
