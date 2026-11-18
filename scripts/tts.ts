/**
 * Records every French text of the content with speech synthesis and uploads it to R2.
 *
 *   npm run tts                    record what the manifest lacks, upload, update content/_audio/manifest.json
 *   npm run tts -- --dry-run       count new texts and characters, send nothing
 *   npm run tts -- --sample 20     record 20 random sentences in candidate voices to .audio-sample/ (no upload)
 *   npm run tts -- --prune [--yes] list (and with --yes delete) recordings the content no longer uses
 *   npm run tts -- --keep-voices   before changing `voices` in config.json: every recorded text keeps its voice and file
 *                                  (content/_audio/kept-voices.json); later runs drop entries the content no longer needs
 *
 * Keys come from the environment or .dev.vars: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.
 * --prune --yes also purges the deleted files from the edge cache with CLOUDFLARE_ZONE_ID and CLOUDFLARE_PURGE_TOKEN (Zone › Cache Purge).
 * `--rpm <n>` caps synthesis requests per minute (default 18: Azure's free tier allows 20).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { audioKey, KEPT_HASH, newVoice, voiceFor, type AudioConfig, type KeptVoices, type Manifest } from '../src/audio/manifest';
import { collectAudioTexts, type AudioText } from '../src/audio/texts';
import { loadPacks, type ContentFiles } from '../src/content/loader';
import { exerciseTypeInfo } from '../src/exercises/logic';
import { azureTts } from './tts/azure';
import type { TtsProvider } from './tts/provider';
import { purgeUrls } from './tts/purge';
import { r2Bucket } from './tts/r2';

const CONFIG = 'content/_audio/config.json';
const MANIFEST = 'content/_audio/manifest.json';
const KEPT = 'content/_audio/kept-voices.json';
const SAMPLE_DIR = '.audio-sample';
const PARALLEL = 4;
const SAMPLE_VOICES = [
  'fr-FR-DeniseNeural',
  'fr-FR-VivienneMultilingualNeural',
  'fr-FR-BrigitteNeural',
  'fr-FR-HenriNeural',
  'fr-FR-RemyMultilingualNeural',
  'fr-FR-AlainNeural',
];

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean' },
    sample: { type: 'string' },
    voices: { type: 'string' },
    prune: { type: 'boolean' },
    'keep-voices': { type: 'boolean' },
    yes: { type: 'boolean' },
    rpm: { type: 'string', default: '18' },
  },
});

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

function loadEnv() {
  if (!existsSync('.dev.vars')) return;
  for (const line of readFileSync('.dev.vars', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^"(.*)"$/, '$1');
  }
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (environment or .dev.vars)`);
  return value;
}

function loadContent() {
  const files: Required<ContentFiles> = { packs: {}, units: {}, sheets: {} };
  for (const dir of readdirSync('content')) {
    if (dir.startsWith('_') || !existsSync(join('content', dir, 'pack.json'))) continue;
    files.packs[`/content/${dir}/pack.json`] = readJson(join('content', dir, 'pack.json'));
    for (const kind of ['units', 'sheets'] as const) {
      const sub = join('content', dir, kind);
      if (!existsSync(sub)) continue;
      for (const f of readdirSync(sub)) if (f.endsWith('.json')) files[kind][`/content/${dir}/${kind}/${f}`] = readJson(join(sub, f));
    }
  }
  const content = loadPacks(files, exerciseTypeInfo);
  if (content.issues.length) {
    throw new Error(`content does not validate:\n${content.issues.map((i) => `${i.file} › ${i.path}: ${i.message}`).join('\n')}`);
  }
  return content;
}

/** Runs calls at most `rpm` a minute, waiting out 429s and retrying server errors. */
function throttled(rpm: number) {
  const gap = 60_000 / rpm;
  let next = 0;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      const wait = next - Date.now();
      next = Math.max(Date.now(), next) + gap;
      if (wait > 0) await sleep(wait);
      try {
        return await fn();
      } catch (e) {
        const { status, retryAfter } = e as { status?: number; retryAfter?: number };
        if ((status !== 429 && !(status && status >= 500)) || attempt >= 5) throw e;
        const backoff = (retryAfter ?? 10 * (attempt + 1)) * 1000;
        console.warn(`  ${status}, retrying in ${backoff / 1000} s`);
        next = Date.now() + backoff;
      }
    }
  };
}

function provider(config: AudioConfig): TtsProvider {
  if (config.provider !== 'azure') throw new Error(`unknown provider ${config.provider}`);
  return azureTts({ key: env('AZURE_SPEECH_KEY'), region: env('AZURE_SPEECH_REGION'), format: config.format });
}

function bucket(config: AudioConfig) {
  return r2Bucket({
    accountId: env('R2_ACCOUNT_ID'),
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    bucket: config.bucket,
  });
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function saveManifest(manifest: Manifest) {
  // Sorted, so the committed manifest diffs cleanly.
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(MANIFEST, JSON.stringify(sorted, null, 1) + '\n');
}

async function sample(texts: AudioText[], config: AudioConfig, count: number) {
  const voices = args.voices?.split(',').map((v) => v.trim()) ?? SAMPLE_VOICES;
  const sentences = texts.filter((t) => t.text.split(' ').length >= 4);
  const picked = [...sentences].sort(() => Math.random() - 0.5).slice(0, count);
  const tts = provider(config);
  const limit = throttled(Number(args.rpm));
  mkdirSync(SAMPLE_DIR, { recursive: true });
  const failed = new Set<string>();
  console.log(`${picked.length} sentences × ${voices.length} voices`);
  for (const [i, t] of picked.entries()) {
    for (const voice of voices) {
      if (failed.has(voice)) continue;
      try {
        const audio = await limit(() => tts.synthesize(t.text, voice, config.lang));
        writeFileSync(join(SAMPLE_DIR, `${i}-${voice}.mp3`), Buffer.from(audio));
      } catch (e) {
        console.warn(`  ${voice}: ${(e as Error).message} (skipping this voice)`);
        failed.add(voice);
      }
    }
    console.log(`  ${i + 1}/${picked.length} ${t.text}`);
  }
  const ok = voices.filter((v) => !failed.has(v));
  const rows = picked
    .map((t, i) => `<tr><td>${escapeHtml(t.text)}</td>${ok.map((v) => `<td><audio controls preload="none" src="${i}-${v}.mp3"></audio></td>`).join('')}</tr>`)
    .join('\n');
  writeFileSync(
    join(SAMPLE_DIR, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Voice sample</title>
<style>body{font:15px system-ui;margin:16px}td,th{padding:4px 8px;border-bottom:1px solid #ddd;text-align:left}audio{width:150px}</style>
<table><tr><th>Phrase</th>${ok.map((v) => `<th>${v.replace(/^fr-FR-|Neural$/g, '')}</th>`).join('')}</tr>
${rows}</table>
`,
  );
  console.log(`\nOpen ${join(SAMPLE_DIR, 'index.html')} and put the two chosen voices in ${CONFIG}.`);
}

async function prune(wanted: { key: string }[], config: AudioConfig, manifest: Manifest) {
  const used = new Set(wanted.map((w) => `${w.key}.mp3`));
  const r2 = bucket(config);
  const unused = (await r2.list()).filter((name) => !used.has(name));
  console.log(`${unused.length} recording(s) in ${config.bucket} the content no longer uses${unused.length ? ':' : '.'}`);
  for (const name of unused) console.log(`  ${name}  ${manifest[name.replace(/\.mp3$/, '')]?.text ?? '(not in manifest)'}`);
  if (!args.yes) {
    if (unused.length) console.log('\nRun with --yes to delete them.');
    return;
  }
  for (const name of unused) {
    await r2.delete(name);
    delete manifest[name.replace(/\.mp3$/, '')];
  }
  saveManifest(manifest);
  console.log(`Deleted ${unused.length}.`);
  if (unused.length) await purge(unused.map((name) => `${config.baseUrl}/${name}`));
}

async function purge(urls: string[]) {
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  const token = process.env.CLOUDFLARE_PURGE_TOKEN;
  if (!zoneId || !token) {
    console.warn('\nCLOUDFLARE_ZONE_ID / CLOUDFLARE_PURGE_TOKEN not set: the edge keeps serving the deleted files until its TTL. Purge these URLs in the dashboard:');
    for (const url of urls) console.warn(`  ${url}`);
    return;
  }
  await purgeUrls({ zoneId, token }, urls);
  console.log(`Purged ${urls.length} URL(s) from the edge cache.`);
}

const saveKept = (kept: KeptVoices) => {
  const texts = Object.fromEntries(Object.entries(kept.texts).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(KEPT, JSON.stringify({ voices: kept.voices, texts }, null, 1) + '\n');
};

/** Every text recorded under the current voices keeps its voice once `voices` changes. */
function keepVoices(texts: AudioText[], config: AudioConfig, manifest: Manifest) {
  const kept: KeptVoices = { voices: [...(config.kept?.voices ?? [])], texts: { ...config.kept?.texts } };
  let added = 0;
  for (const t of texts) {
    const voice = voiceFor(config, t.text, sha256);
    if (!manifest[audioKey(config.provider, voice, t.text, sha256)]) continue;
    if (!kept.voices.includes(voice)) kept.voices.push(voice);
    const hash = sha256(t.text).slice(0, KEPT_HASH);
    if (kept.texts[hash] === undefined) added++;
    kept.texts[hash] = kept.voices.indexOf(voice);
  }
  saveKept(kept);
  console.log(`${added} recorded text(s) keep their voice (${KEPT}). Now change voices in ${CONFIG}.`);
}

/** Drops kept voices for texts the content no longer has, or that the current voices would give anyway. */
function tidyKept(texts: AudioText[], config: AudioConfig) {
  const kept = config.kept;
  if (!kept) return;
  const needed = new Map(texts.map((t) => { const h = sha256(t.text); return [h.slice(0, KEPT_HASH), h] as const; }));
  const entries = Object.entries(kept.texts).filter(([short, i]) => {
    const full = needed.get(short);
    return full !== undefined && kept.voices[i] !== newVoice(config, full);
  });
  if (entries.length !== Object.keys(kept.texts).length) saveKept({ voices: kept.voices, texts: Object.fromEntries(entries) });
}

async function main() {
  loadEnv();
  const config: AudioConfig = { ...readJson<AudioConfig>(CONFIG), kept: existsSync(KEPT) ? readJson<KeptVoices>(KEPT) : undefined };
  const texts = collectAudioTexts(loadContent());

  if (args.sample) return sample(texts, config, Number(args.sample));

  if (!config.voices.length) {
    const chars = texts.reduce((sum, t) => sum + t.text.length, 0);
    console.log(`${texts.length} texts (${chars.toLocaleString('en')} characters). No voices in ${CONFIG} yet: pick them with --sample.`);
    return;
  }

  const manifest = readJson<Manifest>(MANIFEST);
  if (args['keep-voices']) return keepVoices(texts, config, manifest);
  if (!args['dry-run']) tidyKept(texts, config);
  const wanted = texts.map((t) => {
    const voice = voiceFor(config, t.text, sha256);
    return { ...t, voice, key: audioKey(config.provider, voice, t.text, sha256) };
  });

  if (args.prune) return prune(wanted, config, manifest);

  const missing = wanted.filter((w) => !manifest[w.key]);
  const chars = missing.reduce((sum, w) => sum + w.text.length, 0);
  console.log(`${wanted.length} texts, ${missing.length} to record (${chars.toLocaleString('en')} characters).`);
  if (args['dry-run'] || !missing.length) return;

  const tts = provider(config);
  const r2 = bucket(config);
  const limit = throttled(Number(args.rpm));
  console.log(`About ${Math.ceil(missing.length / Number(args.rpm))} min at ${args.rpm} requests/min. Safe to stop: progress is saved after each file.`);
  // A request and an upload take a few seconds, so several run at once to reach the rate limit.
  const queue = [...missing];
  let done = 0;
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      for (let w = queue.shift(); w; w = queue.shift()) {
        const item = w;
        const audio = await limit(() => tts.synthesize(item.text, item.voice, config.lang));
        await r2.put(`${item.key}.mp3`, audio, 'audio/mpeg');
        manifest[item.key] = { text: item.text, voice: item.voice, bytes: audio.byteLength };
        saveManifest(manifest);
        console.log(`  ${++done}/${missing.length} ${item.text}`);
      }
    }),
  );
}

main().catch((e: unknown) => {
  console.error((e as Error).message);
  process.exit(1);
});
