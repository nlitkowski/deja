import { z } from 'zod';
import { HELP_LANGS } from '../content/localized';
import { COLOR_MODES, PALETTES, type Settings } from './storage';

/**
 * Settings that follow the account across devices, last write wins per field. The daily goal is not here:
 * it lives in the event log (SettingEvent), because past streak days depend on its history.
 * The collapsed navigation tree stays per device.
 */
export const SYNCED_SETTINGS = ['helpLang', 'palette', 'colorMode', 'sound', 'vibration'] as const;
export type SyncedKey = (typeof SYNCED_SETTINGS)[number];

/** Each synced field with the time it was last changed (ISO). */
export type StampedSettings = { [K in SyncedKey]?: { value: Settings[K]; at: string } };

/** For settings never changed on this device: older than any real change, so another device's choice wins. */
export const NEVER = '1970-01-01T00:00:00.000Z';

const FIELDS = {
  helpLang: z.enum(HELP_LANGS),
  palette: z.enum(PALETTES),
  colorMode: z.enum(COLOR_MODES),
  sound: z.boolean(),
  vibration: z.boolean(),
} satisfies { [K in SyncedKey]: z.ZodType<Settings[K]> };

const stamp = z.object({ value: z.unknown(), at: z.iso.datetime() });

/** Keeps the valid fields of untrusted input and drops the rest. */
export function parseStamped(raw: unknown): StampedSettings {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== 'object') return {};
  for (const key of SYNCED_SETTINGS) {
    const field = stamp.safeParse((raw as Record<string, unknown>)[key]);
    if (!field.success) continue;
    const value = FIELDS[key].safeParse(field.data.value);
    if (value.success) out[key] = { value: value.data, at: field.data.at };
  }
  return out as StampedSettings;
}

/** Per field, the newer change wins; on a tie `base` keeps its value, so merging is deterministic. */
export function mergeStamped(base: StampedSettings, incoming: StampedSettings): StampedSettings {
  const out: Record<string, unknown> = { ...base };
  for (const key of SYNCED_SETTINGS) {
    const next = incoming[key];
    const current = base[key];
    if (next && (!current || next.at > current.at)) out[key] = next;
  }
  return out as StampedSettings;
}

/** The synced part of settings, stamped with when each field changed here. */
export function stampSettings(settings: Settings, stamps: Partial<Record<SyncedKey, string>>): StampedSettings {
  return Object.fromEntries(SYNCED_SETTINGS.map((key) => [key, { value: settings[key], at: stamps[key] ?? NEVER }])) as StampedSettings;
}
