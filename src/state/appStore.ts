import { create } from 'zustand';
import { dayKey } from '../lib/date';
import { baselineFromLegacy } from '../lib/progress/baseline';
import { newEventId, type ProgressEvent, type QuestEvent, type ReviewEvent, type SessionEvent, type SettingEvent } from '../lib/progress/events';
import { emptyProgress, type ProgressState } from '../lib/progress/fold';
import { Projection } from '../lib/progress/projection';
import { indexedDbStore, type ProgressStore } from '../lib/progress/store';
import { gradeFromResult, type AnswerResult } from '../lib/srs';
import { browserStore, deviceId, loadState, saveState, SCHEMA_VERSION, type KeyValueStore, type Settings } from '../lib/storage';

export interface AnswerInput {
  exerciseId: string;
  entryIds: string[];
  result: AnswerResult;
  early: boolean;
  sessionId?: string;
  comboBefore?: number;
  production?: boolean;
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
}

interface Deps {
  progressStore: ProgressStore;
  kv: KeyValueStore | undefined;
}

export function createAppStore({ progressStore, kv }: Deps) {
  const loaded = loadState(kv);
  const device = deviceId(kv);
  const persistSettings = (settings: Settings) => saveState({ schemaVersion: SCHEMA_VERSION, settings }, kv);
  // init() may be called more than once (React StrictMode runs effects twice); the migration must run once.
  let initializing: Promise<void> | undefined;
  const projection = new Projection();

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
        if (patch.dailyGoal !== undefined && patch.dailyGoal !== previous.dailyGoal) {
          record<SettingEvent>({ type: 'setting', ...base(now), key: 'dailyGoal', value: patch.dailyGoal }, 'goal change');
        }
      },

      recordAnswer({ exerciseId, entryIds, result, early, sessionId, comboBefore, production }, now = new Date()) {
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
    };
  });
}

export const useAppStore = createAppStore({ progressStore: indexedDbStore(), kv: browserStore() });
