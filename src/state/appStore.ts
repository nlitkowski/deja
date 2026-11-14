import { create } from 'zustand';
import { dayKey } from '../lib/date';
import { baselineFromLegacy } from '../lib/progress/baseline';
import { newEventId, type ReviewEvent } from '../lib/progress/events';
import { applyEvent, emptyProgress, foldEvents, type ProgressState } from '../lib/progress/fold';
import { indexedDbStore, type ProgressStore } from '../lib/progress/store';
import { gradeFromResult, type AnswerResult } from '../lib/srs';
import { browserStore, deviceId, loadState, saveState, SCHEMA_VERSION, type KeyValueStore, type Settings } from '../lib/storage';

export interface AnswerInput {
  exerciseId: string;
  entryIds: string[];
  result: AnswerResult;
  early: boolean;
}

export interface AppState {
  /** `failed`: the event log could not be opened; the app still works, but answers are not saved. */
  status: 'loading' | 'ready' | 'failed';
  settings: Settings;
  progress: ProgressState;
  init: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  recordAnswer: (input: AnswerInput, now?: Date) => ReviewEvent;
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
        set({ progress: foldEvents(events), status: 'ready' });
      } catch (error) {
        console.error('Déjà: event log unavailable', error);
        set({ status: 'failed' });
      }
    }

    return {
      status: 'loading',
      settings: loaded.state.settings,
      progress: emptyProgress(),

      init: () => (initializing ??= load()),

      updateSettings(patch) {
        const settings = { ...get().settings, ...patch };
        set({ settings });
        persistSettings(settings);
      },

      recordAnswer({ exerciseId, entryIds, result, early }, now = new Date()) {
        const event: ReviewEvent = {
          type: 'review',
          id: newEventId(),
          deviceId: device,
          at: now.toISOString(),
          day: dayKey(now),
          exerciseId,
          entryIds,
          grade: gradeFromResult(result),
          correct: result.correct,
          nearMiss: result.nearMiss,
          hintUsed: result.hintUsed,
          timeMs: Math.round(result.timeMs),
          early,
        };
        // Newest event, so applying it to the folded state equals refolding the whole log.
        set((s) => ({ progress: applyEvent(s.progress, event) }));
        progressStore.append([event]).catch((error) => console.error('Déjà: answer not saved', error));
        return event;
      },
    };
  });
}

export const useAppStore = createAppStore({ progressStore: indexedDbStore(), kv: browserStore() });
