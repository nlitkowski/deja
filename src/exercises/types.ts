import type { ComponentType } from 'react';
import type { ZodType } from 'zod';
import type { HelpLang } from '../content/localized';
import type { Entry, Exercise } from '../content/schema';
import type { AnswerResult, Skill } from '../lib/srs';

export type { AnswerResult };

export interface ExerciseContext {
  accentPairs: Set<string>;
  helpLang: HelpLang;
}

export interface ViewProps<D> {
  data: D;
  ctx: ExerciseContext;
  /** True after the answer was given; the view shows its final state and ignores input. */
  locked: boolean;
  onAnswer: (result: AnswerResult) => void;
}

export interface GenCtx {
  unitEntries: Entry[];
  allEntries: ReadonlyMap<string, Entry>;
  /** Hand-written exercises practising the entry. */
  exercisesOf: (entryId: string) => readonly Exercise[];
}

export interface Generated<D> {
  data: D;
  entryIds: string[];
}

export interface ExerciseLogic<D> {
  id: string;
  schema: ZodType<D>;
  /** The user types the answer (worth more XP than choosing it). */
  production: boolean;
  /** Which of the entry's cards an answer trains. */
  skill: Skill;
  /** Help languages the exercise works in; omitted = all. */
  helpLangs?: readonly HelpLang[];
  /** Builds exercises from hand-written content; each may ask about several entries. */
  generate?: (entry: Entry, ctx: GenCtx) => Generated<D>[];
}

export interface ExerciseType<D> extends ExerciseLogic<D> {
  View: ComponentType<ViewProps<D>>;
}
