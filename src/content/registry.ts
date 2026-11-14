import { buildPairSet } from '../lib/answer';
import { exerciseTypeInfo } from '../exercises/registry';
import { loadPacks } from './loader';

// `_*` directories (e.g. `_template`) are documentation, not content.
export const contentFiles = {
  packs: import.meta.glob(['/content/*/pack.json', '!/content/_*/**'], { eager: true, import: 'default' }),
  units: import.meta.glob(['/content/*/units/*.json', '!/content/_*/**'], { eager: true, import: 'default' }),
  sheets: import.meta.glob(['/content/*/sheets/*.json', '!/content/_*/**'], { eager: true, import: 'default' }),
};

export const content = loadPacks(contentFiles, exerciseTypeInfo);

export const accentPairs = buildPairSet(content.packs.flatMap((p) => p.accentPairs));

export const allEntries = () => content.packs.flatMap((p) => p.unitList.flatMap((u) => u.entryIds.map((id) => content.entries.get(id)!)));
