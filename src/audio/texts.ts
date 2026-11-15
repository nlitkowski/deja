import type { Audio } from '../content/audio';
import type { LoadedContent } from '../content/loader';
import type { Exercise } from '../content/schema';
import type { SheetBlock } from '../content/sheet';
import { exerciseLogic } from '../exercises/logic';
import { audioTextOf, normalizeText, spoken } from './spoken';

export { audioTextOf, normalizeText, spoken } from './spoken';

/** A French text to record, with every place in the content that shows it. */
export interface AudioText {
  /** Normalized text sent to speech synthesis; equal texts share one recording. */
  text: string;
  /** False when any place keeps it out of dictation. */
  dictation: boolean;
  /** Where it comes from, for messages: `<pack>/<unit> › <what>`. */
  sources: string[];
}

/** A table cell worth recording: a whole sentence, not a label or a fragment. */
export function isSentence(cell: string): boolean {
  const text = normalizeText(cell);
  return /^[A-ZÀ-Ý«"]/.test(text) && /[.?!…»"]$/.test(text) && text.includes(' ') && !/ \/ |[=+]/.test(text);
}

const logicById = new Map(exerciseLogic.map((t) => [t.id, t]));

/** The whole sentence of an exercise, as recorded; undefined for types without one (duels, pairs). */
export function exerciseAudioText(ex: Pick<Exercise, 'type' | 'data' | 'audio'>): string | undefined {
  const written = logicById.get(ex.type)?.audioText?.(ex.data);
  return written === undefined ? undefined : audioTextOf(written, ex.audio);
}

export interface AudioScope {
  /** Unit keys (`<pack>/<unit>`); omitted = every unit. */
  units?: ReadonlySet<string>;
  /** Sheet keys; omitted = every sheet. */
  sheets?: ReadonlySet<string>;
}

export function collectAudioTexts(content: LoadedContent, scope: AudioScope = {}): AudioText[] {
  const byText = new Map<string, AudioText>();

  function add(text: string | undefined, audio: Audio | undefined, source: string) {
    if (!text) return;
    const item = byText.get(text) ?? { text, dictation: true, sources: [] };
    if (audio?.dictation === false) item.dictation = false;
    item.sources.push(source);
    byText.set(text, item);
  }

  for (const pack of content.packs) {
    for (const unit of pack.unitList) {
      if (scope.units && !scope.units.has(unit.key)) continue;
      for (const id of unit.entryIds) {
        const entry = content.entries.get(id)!;
        if (entry.deprecated) continue;
        add(audioTextOf(entry.fr, entry.audio), entry.audio, `${unit.key} › ${id}`);
        entry.examples.forEach((ex, i) => add(audioTextOf(ex.fr, ex.audio), ex.audio, `${unit.key} › ${id} › examples.${i}`));
      }
      for (const id of unit.exerciseIds) {
        const ex = content.exercises.get(id)!;
        if (ex.generated) continue;
        add(exerciseAudioText(ex), ex.audio, `${unit.key} › ${id}`);
        logicById.get(ex.type)?.listenTexts?.(ex.data).forEach((t, i) => add(spoken(t) || undefined, undefined, `${unit.key} › ${id} › ${i}`));
      }
    }
    for (const sheet of pack.sheetList) {
      if (scope.sheets && !scope.sheets.has(sheet.key)) continue;
      sheet.sections.forEach((section, s) =>
        section.blocks.forEach((block: SheetBlock, b) => {
          const where = `${sheet.key} › sections.${s}.blocks.${b}`;
          if (block.type === 'examples' || block.type === 'words') {
            block.items.forEach((item, i) => add(audioTextOf(item.fr, item.audio), item.audio, `${where}.items.${i}`));
          } else if (block.type === 'table' && !block.audio?.skip) {
            block.rows.forEach((row, r) => row.forEach((cell, c) => isSentence(cell) && add(audioTextOf(cell), undefined, `${where}.rows.${r}.${c}`)));
          }
        }),
      );
    }
  }
  return [...byText.values()];
}
