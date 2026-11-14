import { z } from 'zod';
import type { ProgressEvent } from './events';

/**
 * Runtime shape of every event type, shared by the app (backups) and the API (sync), so both accept
 * exactly the same events. parseEvent returning the parsed value as a ProgressEvent keeps the two in step.
 */
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const base = { id: z.string().min(1), deviceId: z.string().min(1), at: z.iso.datetime(), day };
const card = z.object({
  ease: z.number(),
  interval: z.number(),
  due: day,
  reps: z.number(),
  lapses: z.number(),
  correctTotal: z.number(),
  lastReviewed: day,
});

export const EventSchema = z.discriminatedUnion('type', [
  z.object({
    ...base,
    type: z.literal('review'),
    exerciseId: z.string(),
    entryIds: z.array(z.string()),
    grade: z.enum(['again', 'hard', 'good', 'easy']),
    correct: z.boolean(),
    nearMiss: z.boolean(),
    hintUsed: z.boolean(),
    timeMs: z.number(),
    early: z.boolean(),
    sessionId: z.string().optional(),
    comboBefore: z.number().optional(),
    production: z.boolean().optional(),
  }),
  z.object({
    ...base,
    type: z.literal('baseline'),
    cards: z.record(z.string(), card),
    introduced: z.object({ day, count: z.number() }).optional(),
  }),
  z.object({
    ...base,
    type: z.literal('session'),
    sessionId: z.string(),
    kind: z.enum(['review', 'unit', 'boss']),
    unitKey: z.string().optional(),
    startedAt: z.string(),
    items: z.number(),
    correct: z.number(),
    mistakes: z.number(),
    maxCombo: z.number(),
    defeated: z.boolean().optional(),
  }),
  z.object({ ...base, type: z.literal('setting'), key: z.literal('dailyGoal'), value: z.number() }),
  z.object({ ...base, type: z.literal('quest'), questId: z.string(), period: day, xp: z.number() }),
]);

/** Validates one event; unknown types and damaged events give null rather than throwing. */
export function parseEvent(value: unknown): ProgressEvent | null {
  const parsed = EventSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
