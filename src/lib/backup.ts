import { z } from 'zod';
import { HELP_LANGS } from '../content/localized';
import type { ProgressEvent } from './progress/events';
import { EventSchema } from './progress/schema';
import { COLOR_MODES, PALETTES, type Settings } from './storage';

/**
 * A backup is the whole event log plus settings. Importing merges events by id, so restoring an older
 * backup or the same one twice never loses or duplicates progress: the log is a set of immutable events.
 */
export const BACKUP_FORMAT = 'deja-backup';
const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  settings: Settings;
  events: ProgressEvent[];
}

// Each setting falls back on its own, so a backup from an older or newer version still restores what it can.
const SettingsSchema = z.object({
  dailyGoal: z.union([z.literal(30), z.literal(50), z.literal(100)]).optional().catch(undefined),
  sound: z.boolean().optional().catch(undefined),
  vibration: z.boolean().optional().catch(undefined),
  helpLang: z.enum(HELP_LANGS).optional().catch(undefined),
  colorMode: z.enum(COLOR_MODES).optional().catch(undefined),
  palette: z.enum(PALETTES).optional().catch(undefined),
  navCollapsed: z.boolean().optional().catch(undefined),
});

const BackupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number(),
  exportedAt: z.string(),
  settings: SettingsSchema.catch({}),
  events: z.array(EventSchema),
});

export function createBackup(events: readonly ProgressEvent[], settings: Settings, now: Date): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), settings, events: [...events] };
}

export const backupFileName = (today: string) => `deja-sauvegarde-${today}.json`;

export type ParsedBackup =
  | { ok: true; events: ProgressEvent[]; settings: Partial<Settings>; exportedAt: string }
  | { ok: false; reason: 'notBackup' | 'newerVersion' | 'damaged' };

export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'notBackup' };
  }
  if (!raw || typeof raw !== 'object' || (raw as { format?: unknown }).format !== BACKUP_FORMAT) return { ok: false, reason: 'notBackup' };
  if (typeof (raw as { version?: unknown }).version === 'number' && (raw as { version: number }).version > BACKUP_VERSION) {
    return { ok: false, reason: 'newerVersion' };
  }
  const parsed = BackupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: 'damaged' };
  const settings = Object.fromEntries(Object.entries(parsed.data.settings).filter(([, v]) => v !== undefined)) as Partial<Settings>;
  return { ok: true, events: parsed.data.events as ProgressEvent[], settings, exportedAt: parsed.data.exportedAt };
}

/** Events from the backup that this log does not have yet. */
export function missingEvents(log: readonly ProgressEvent[], incoming: readonly ProgressEvent[]): ProgressEvent[] {
  const known = new Set(log.map((e) => e.id));
  const fresh = new Map<string, ProgressEvent>();
  for (const e of incoming) if (!known.has(e.id)) fresh.set(e.id, e);
  return [...fresh.values()];
}
