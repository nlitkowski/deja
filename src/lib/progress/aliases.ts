/**
 * Merged entries: a deprecated entry's past answers count toward the entry that replaced it (`replacedBy`),
 * so content can be consolidated without editing events. Set once from the loaded content.
 */
let aliases: ReadonlyMap<string, string> = new Map();

export function setEntryAliases(map: ReadonlyMap<string, string>): void {
  aliases = map;
}

export const resolveEntryId = (id: string): string => aliases.get(id) ?? id;

/** Resolved and deduplicated: two merged entries in one answer update the new card once. */
export const resolveEntryIds = (ids: readonly string[]): string[] => [...new Set(ids.map(resolveEntryId))];
