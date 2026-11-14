import { dayKey } from '../date';
import type { LegacyProgress } from '../storage';
import { newEventId, type BaselineEvent } from './events';

export function baselineFromLegacy(legacy: LegacyProgress, deviceId: string, now: Date): BaselineEvent {
  return {
    type: 'baseline',
    id: newEventId(),
    deviceId,
    at: now.toISOString(),
    day: dayKey(now),
    cards: legacy.srs,
    introduced: legacy.daily.day ? { day: legacy.daily.day, count: legacy.daily.newIntroduced } : undefined,
  };
}
