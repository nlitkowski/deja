import { create } from 'zustand';
import { missingEvents } from '../lib/backup';
import { dayKey } from '../lib/date';
import { baselineFromLegacy } from '../lib/progress/baseline';
import { newEventId, type ProgressEvent, type QuestEvent, type ReviewEvent, type SessionEvent, type SettingEvent } from '../lib/progress/events';
import { emptyProgress, type ProgressState } from '../lib/progress/fold';
import { Projection } from '../lib/progress/projection';
import type { ProgressStore } from '../lib/progress/store';
import { appendingStore } from './localStore';
import { gradeFromResult, type AnswerResult, type Skill } from '../lib/srs';
import { compareEvents } from '../lib/progress/fold';
import { NEVER, parseStamped, stampSettings, SYNCED_SETTINGS, type StampedSettings, type SyncedKey } from '../lib/settingsSync';
import { browserStore, deviceId, loadState, normalizeGoal, saveState, SCHEMA_VERSION, type KeyValueStore, type Settings } from '../lib/storage';

export interface AnswerInput {
  exerciseId: string;
  entryIds: string[];
  result: AnswerResult;
  early: boolean;
  sessionId?: string;
  comboBefore?: number;
  production?: boolean;
  skill?: Skill;
}

export type SessionInput = Omit<SessionEvent, 'type' | 'id' | 'deviceId' | 'at' | 'day'>;

export interface AppState {
  /** `failed`: the event log could not be opened; the app still works, but answers are not saved. */
  status: 'loading' | 'ready' | 'failed';
  settings: Settings;
  progress: ProgressState;
  /** The whole event log, for projections beyond SRS (XP, streak). A new array on every change. */
  log: readonly ProgressEvent[];
  init: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>, now?: Date) => void;
  recordAnswer: (input: AnswerInput, now?: Date) => ReviewEvent;
  recordSession: (input: SessionInput, now?: Date) => SessionEvent;
  claimQuest: (input: { questId: string; period: string; xp: number }, now?: Date) => QuestEvent | undefined;
  /** Merges a backup into the log and restores its settings; resolves to how many events were new. */
  importBackup: (events: readonly ProgressEvent[], settings: Partial<Settings>) => Promise<number>;
  /** Events another device made, pulled by sync and already stored locally. */
  receive: (events: readonly ProgressEvent[]) => void;
  /** Empties the in-memory log after the local store was cleared (signing out). */
  resetLog: () => void;
  /** The synced settings, each stamped with when it last changed on this device. */
  stampedSettings: () => StampedSettings;
  /** Takes the account's merged settings (from sync): a field newer than this device's change wins. */
  applyRemoteSettings: (merged: unknown) => void;
}

interface Deps {
  progressStore: ProgressStore;
  kv: KeyValueStore | undefined;
}

export function createAppStore({ progressStore, kv }: Deps) {
  const loaded = loadState(kv);
  const device = deviceId(kv);
  const persistSettings = (settings: Settings) => saveState({ schemaVersion: SCHEMA_VERSION, settings }, kv);
  // When each synced setting last changed here; kept apart from `deja:state`, whose shape needs migrations.
  const STAMPS_KEY = 'deja:settings-at';
  let stamps: Partial<Record<SyncedKey, string>> = readStamps(kv, STAMPS_KEY);
  const persistStamps = () => {
    try {
      kv?.setItem(STAMPS_KEY, JSON.stringify(stamps));
    } catch {
      // Storage blocked: the next sync treats these settings as older than the account's.
    }
  };
  // init() may be called more than once (React StrictMode runs effects twice); the migration must run once.
  let initializing: Promise<void> | undefined;
  let projection = new Projection();

  return create<AppState>()((set, get) => {
    async function load() {
      try {
        let events = await progressStore.loadEvents();
        if (loaded.legacy && events.length === 0) {
          const baseline = baselineFromLegacy(loaded.legacy, device, new Date());
          await progressStore.append([baseline]);
          events = [baseline];
        }
        // Only now is the old progress safe in the log, so the pre-v5 blob can be rewritten without it.
        if (loaded.legacy) persistSettings(get().settings);
        projection.add(events);
        set({ progress: projection.state, log: projection.events, status: 'ready' });
        // v6 rescaled the goal: past days keep the old one through the log, so the new one starts from today.
        if (loaded.goalRescaled) {
          record<SettingEvent>({ type: 'setting', ...base(new Date()), key: 'dailyGoal', value: loaded.goalRescaled.to }, 'goal rescale');
          persistSettings(get().settings);
        }
      } catch (error) {
        console.error('Déjà: event log unavailable', error);
        set({ status: 'failed' });
      }
    }

    function record<E extends ProgressEvent>(event: E, what: string): E {
      projection.add([event]);
      set({ progress: projection.state, log: projection.events });
      progressStore.append([event]).catch((error) => console.error(`Déjà: ${what} not saved`, error));
      return event;
    }

    const base = (now: Date) => ({ id: newEventId(), deviceId: device, at: now.toISOString(), day: dayKey(now) });

    return {
      status: 'loading',
      settings: loaded.state.settings,
      progress: emptyProgress(),
      log: [],

      init: () => (initializing ??= load()),

      updateSettings(patch, now = new Date()) {
        const previous = get().settings;
        const settings = { ...previous, ...patch };
        set({ settings });
        persistSettings(settings);
        const changed = SYNCED_SETTINGS.filter((key) => key in patch && patch[key] !== previous[key]);
        if (changed.length) {
          stamps = { ...stamps, ...Object.fromEntries(changed.map((key) => [key, now.toISOString()])) };
          persistStamps();
        }
        if (patch.dailyGoal !== undefined && patch.dailyGoal !== previous.dailyGoal) {
          record<SettingEvent>({ type: 'setting', ...base(now), key: 'dailyGoal', value: patch.dailyGoal }, 'goal change');
        }
      },

      recordAnswer({ exerciseId, entryIds, result, early, sessionId, comboBefore, production, skill }, now = new Date()) {
        const event: ReviewEvent = {
          type: 'review',
          ...base(now),
          exerciseId,
          entryIds,
          grade: gradeFromResult(result),
          correct: result.correct,
          nearMiss: result.nearMiss,
          hintUsed: result.hintUsed,
          timeMs: Math.round(result.timeMs),
          early,
          ...(sessionId ? { sessionId, comboBefore } : {}),
          ...(production !== undefined ? { production } : {}),
          // Written stays implicit, so its events look exactly like those from before skills existed.
          ...(skill && skill !== 'written' ? { skill } : {}),
          ...(result.replays ? { replays: result.replays } : {}),
        };
        return record(event, 'answer');
      },

      recordSession(input, now = new Date()) {
        return record<SessionEvent>({ type: 'session', ...base(now), ...input }, 'session');
      },

      claimQuest(input, now = new Date()) {
        // A second tap (or another device) must not pay the reward twice.
        const already = get().log.some((e) => e.type === 'quest' && e.questId === input.questId && e.period === input.period);
        if (already) return undefined;
        return record<QuestEvent>({ type: 'quest', ...base(now), ...input }, 'quest');
      },

      async importBackup(events, imported) {
        const added = missingEvents(get().log, events);
        // Saved before it is shown, so a failed write is reported instead of silently lost on reload.
        if (added.length) await progressStore.append(added);
        projection.add(added);
        // Set directly, not through updateSettings: the backup's log already holds its daily goal history.
        const settings = { ...get().settings, ...imported };
        persistSettings(settings);
        set({ settings, progress: projection.state, log: projection.events });
        return added.length;
      },

      receive(events) {
        if (!projection.add(events)) return;
        set({ progress: projection.state, log: projection.events });
        // A goal changed on another device: the setting follows the latest change in the log.
        if (events.some((e) => e.type === 'setting')) {
          const latest = projection.events.filter((e) => e.type === 'setting' && e.key === 'dailyGoal').sort(compareEvents).at(-1);
          if (latest?.type === 'setting' && normalizeGoal(latest.value) !== get().settings.dailyGoal) {
            const settings = { ...get().settings, dailyGoal: normalizeGoal(latest.value) };
            persistSettings(settings);
            set({ settings });
          }
        }
      },

      resetLog() {
        projection = new Projection();
        set({ progress: projection.state, log: projection.events });
      },

      stampedSettings: () => stampSettings(get().settings, stamps),

      applyRemoteSettings(merged) {
        const remote = parseStamped(merged);
        const patch: Partial<Settings> = {};
        for (const key of SYNCED_SETTINGS) {
          const field = remote[key];
          if (!field || field.at <= (stamps[key] ?? NEVER)) continue;
          Object.assign(patch, { [key]: field.value });
          stamps = { ...stamps, [key]: field.at };
        }
        if (!Object.keys(patch).length) return;
        persistStamps();
        const settings = { ...get().settings, ...patch };
        persistSettings(settings);
        set({ settings });
      },
    };
  });
}

export const useAppStore = createAppStore({ progressStore: appendingStore, kv: browserStore() });

function readStamps(kv: KeyValueStore | undefined, key: string): Partial<Record<SyncedKey, string>> {
  try {
    const raw = JSON.parse(kv?.getItem(key) ?? '{}') as Record<string, unknown>;
    return Object.fromEntries(SYNCED_SETTINGS.flatMap((k) => (typeof raw[k] === 'string' ? [[k, raw[k]]] : [])));
  } catch {
    return {};
  }
}
