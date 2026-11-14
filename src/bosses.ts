import { content } from './content/registry';
import type { Exercise } from './content/schema';
import { gapSentences, labelOf } from './exercises/gapSentences';
import type { GenCtx } from './exercises/types';
import { autoBossGroups, buildBossQuestions, type BossGroup, type BossQuestion } from './game/boss';
import { GAME } from './game/config';

export interface Boss {
  questions: BossQuestion[];
  lives: number;
  secondsPerQuestion: number;
}

const written = new Map<string, Exercise[]>();
for (const ex of content.exercises.values()) {
  if (ex.generated) continue;
  for (const id of ex.entryIds) written.set(id, [...(written.get(id) ?? []), ex]);
}

const exercisesOf = (entryId: string) => written.get(entryId) ?? [];

/** The unit's boss, from its `boss` config or, without one, from the unit's confusables. */
export function buildBoss(unitKey: string, rng: () => number = Math.random): Boss | undefined {
  const unit = content.units.get(unitKey);
  if (!unit) return undefined;
  const entries = unit.entryIds.map((id) => content.entries.get(id)!).filter((e) => !e.deprecated);
  const config = unit.boss ?? { groups: autoBossGroups(entries), ...GAME.boss };
  const ctx: GenCtx = { unitEntries: entries, allEntries: content.entries, exercisesOf };

  const groups: BossGroup[] = config.groups.map((ids) => ({
    entryIds: ids,
    labels: Object.fromEntries(ids.flatMap((id) => {
      const label = labelOf(id, ctx);
      return label ? [[id, label]] : [];
    })),
    sentences: Object.fromEntries(ids.map((id) => [id, gapSentences(id, ctx)])),
  }));
  return { questions: buildBossQuestions(groups, config.questions, rng), lives: config.lives, secondsPerQuestion: config.secondsPerQuestion };
}
