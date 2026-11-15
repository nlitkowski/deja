import type { TtsProvider } from './provider';

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Azure AI Speech, neural voices, through the REST API (https://learn.microsoft.com/azure/ai-services/speech-service/rest-text-to-speech). */
export function azureTts({ key, region, format }: { key: string; region: string; format: string }): TtsProvider {
  return {
    id: 'azure',
    async synthesize(text, voice, lang) {
      const ssml = `<speak version="1.0" xml:lang="${lang}"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
      const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': format,
          'User-Agent': 'deja-tts',
        },
        body: ssml,
      });
      if (!res.ok) {
        const retryAfter = Number(res.headers.get('retry-after')) || undefined;
        throw Object.assign(new Error(`Azure TTS ${res.status}: ${await res.text()}`), { status: res.status, retryAfter });
      }
      return res.arrayBuffer();
    },
  };
}
