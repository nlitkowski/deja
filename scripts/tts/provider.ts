/** Swappable speech synthesis (Azure today; e.g. Google Chirp would be another implementation). */
export interface TtsProvider {
  /** Part of every recording's key: switching providers re-records everything. */
  id: string;
  synthesize(text: string, voice: string, lang: string): Promise<ArrayBuffer>;
}
