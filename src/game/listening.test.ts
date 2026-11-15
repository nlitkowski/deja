import { describe, expect, it } from 'vitest';
import { addDays } from '../lib/date';
import type { SrsCard } from '../lib/srs';
import { achievementStats, BADGES, unlockedIds } from './achievements';
import { buildListeningBossQuestions, type ListeningQuestion } from './boss';
import { defeatedBosses, mapState, type MapPack } from './map';
import { DAILY_QUESTS, questDigest, questsFor } from './quests';
import { answer, session } from './testEvents';
import { answerXp, scoreEvents } from './xp';

const types: Record<string, string> = { 'p/dictee': 'dictee', 'p/trous': 'dictee-trous', 'p/pair': 'paires-minimales', 'p/gap': 'gap-fill' };
const listeningCtx = {
  isProduction: (id: string) => id !== 'p/pair' && id !== 'p/chosen',
  exerciseType: (id: string) => types[id],
};
const heard = (exerciseId: string, over: Parameters<typeof answer>[0] = {}) => answer({ exerciseId, skill: 'listening', ...over });
const card = (interval: number, reps = 1): SrsCard => ({ ease: 2.5, interval, due: '2027-06-01', reps, lapses: 0, correctTotal: reps, lastReviewed: '2026-11-14' });

describe('listening XP', () => {
  it('pays a full dictation more than a gap dictation, and choices the recognition base', () => {
    expect(answerXp(heard('p/dictee'), listeningCtx).total).toBe(14);
    expect(answerXp(heard('p/trous'), listeningCtx).total).toBe(12);
    expect(answerXp(heard('p/pair'), listeningCtx).total).toBe(5);
  });

  it('lets an explicit production flag win over the type', () => {
    expect(answerXp(heard('p/dictee', { production: false }), listeningCtx).total).toBe(5);
  });

  it('halves answers about entries already at listening mastery 5, whatever the written card says', () => {
    const gold = Array.from({ length: 6 }, (_, i) => heard('p/trous', { day: addDays('2026-01-01', i * 70), at: `${addDays('2026-01-01', i * 70)}T10:00:00Z` }));
    const scored = scoreEvents([...gold, heard('p/trous', { day: '2027-03-01', at: '2027-03-01T10:00:00Z' })], listeningCtx);
    expect(scored.at(-1)!.xp).toBe(6);
    const written = scoreEvents([...gold, answer({ exerciseId: 'p/gap', day: '2027-03-01', at: '2027-03-01T10:00:00Z' })], listeningCtx);
    expect(written.at(-1)!.xp).toBe(12);
  });
});

describe('map: the listening track', () => {
  const packs: MapPack[] = [{ id: 'a', requires: [], units: [{ key: 'a/1', entryIds: ['a1', 'a2'], listeningBoss: true }, { key: 'a/2', entryIds: ['a3'] }] }];

  it('stays silent until listening starts, then shows its mastery without gating anything', () => {
    const written = { a1: card(8), a2: card(8) };
    const quiet = mapState(packs, written, new Set()).get('a')!;
    expect(quiet.units[0]!.listening).toEqual({ started: false, mastery: 0, golden: false, boss: { unlocked: false, defeated: false } });
    expect(quiet.units[1]!.listening.boss).toBeUndefined();

    const started = mapState(packs, { ...written, 'a1#listening': card(3) }, new Set()).get('a')!;
    expect(started.units[0]!.listening).toMatchObject({ started: true, mastery: 0 });
    expect(started.units[1]!.locked).toBe(false);
  });

  it('opens the listening boss at listening mastery 2 and remembers it beaten, apart from the unit boss', () => {
    const cards = { a1: card(8), a2: card(8), 'a1#listening': card(3), 'a2#listening': card(4) };
    const won = [session({ kind: 'boss-listening', unitKey: 'a/1', defeated: true })];
    const unit = mapState(packs, cards, defeatedBosses(won), defeatedBosses(won, 'boss-listening')).get('a')!.units[0]!;
    expect(unit.listening.boss).toEqual({ unlocked: true, defeated: true });
    expect(unit.boss.defeated).toBe(false);
  });

  it('turns golden when every entry is at listening mastery 5', () => {
    const cards = { a1: card(1), a2: card(1), 'a1#listening': card(60, 4), 'a2#listening': card(90, 5) };
    const unit = mapState(packs, cards, new Set()).get('a')!.units[0]!;
    expect(unit.listening.golden).toBe(true);
    expect(unit.golden).toBe(false);
  });
});

describe('listening badges', () => {
  const input = { cards: {}, units: [{ key: 'a/1', entryIds: ['a1'] }], today: '2026-11-14', xp: listeningCtx };
  const at = (i: number) => `2026-11-14T10:${String(i).padStart(2, '0')}:00Z`;

  it('counts listening answers and clean full dictations', () => {
    const s = achievementStats(
      [heard('p/dictee'), heard('p/dictee', { nearMiss: true }), heard('p/trous'), heard('p/dictee', { correct: false }), answer({ exerciseId: 'p/gap' })],
      input,
    );
    expect(s).toMatchObject({ listeningCorrect: 3, cleanDictations: 1 });
    expect(unlockedIds(BADGES, s).has('premiere-ecoute')).toBe(true);
  });

  it('Sans sous-titres: a completed session with enough listening answers and no replay', () => {
    const run = (sessionId: string, replays: number[]) => replays.map((r, i) => heard('p/trous', { sessionId, at: at(i), replays: r || undefined }));
    const clean = achievementStats([...run('s1', [0, 0, 0, 0, 0]), session({ sessionId: 's1' })], input);
    expect(clean.cleanListeningSessions).toBe(1);
    expect(achievementStats([...run('s1', [0, 0, 1, 0, 0]), session({ sessionId: 's1' })], input).cleanListeningSessions).toBe(0);
    expect(achievementStats([...run('s1', [0, 0, 0, 0])], input).cleanListeningSessions).toBe(0);
    expect(achievementStats(run('s1', [0, 0, 0, 0, 0]), input).cleanListeningSessions).toBe(0);
  });

  it("Oreille d'or: a unit golden by ear", () => {
    const s = achievementStats([], { ...input, cards: { 'a1#listening': card(60, 4) } });
    expect(s.goldenListeningUnits).toBe(1);
    expect(unlockedIds(BADGES, s).has('oreille-d-or')).toBe(true);
  });
});

describe('listening quests', () => {
  it('swap for their written fallback in quiet mode, leaving the rest of the draw alone', () => {
    const days = Array.from({ length: 60 }, (_, i) => addDays('2026-11-01', i));
    const day = days.find((d) => questsFor(d).some((q) => q.quest.quietFallback))!;
    expect(day).toBeDefined();
    const loud = questsFor(day).map((q) => q.quest);
    const quiet = questsFor(day, { quiet: true }).map((q) => q.quest);
    loud.forEach((q, i) => expect(quiet[i]!.id).toBe(q.quietFallback?.id ?? q.id));
  });

  it('count clean dictations of either kind', () => {
    const dictees = DAILY_QUESTS.find((q) => q.id === 'dictees')!;
    const digest = questDigest([heard('p/dictee'), heard('p/trous'), heard('p/trous', { nearMiss: true }), answer({ exerciseId: 'p/gap' })], '2026-11-14', '2026-11-14', {
      ...listeningCtx,
      isTricky: () => false,
    });
    expect(dictees.progress(digest)).toBe(2);
    expect(dictees.quietFallback!.progress(digest)).toBe(1);
  });
});

describe('listening boss questions', () => {
  const q = (id: string): ListeningQuestion => ({ exerciseId: id, entryIds: ['p/a'], type: 'x', data: {} });

  it('alternates the decks and deals a deck again once it is used up', () => {
    let i = 0;
    const rng = () => ((i = (i * 7 + 3) % 10) / 10);
    const out = buildListeningBossQuestions([[q('p1')], [q('d1'), q('d2'), q('d3')]], 6, rng).map((x) => x.exerciseId);
    expect(out.filter((_, k) => k % 2 === 0)).toEqual(['p1', 'p1', 'p1']);
    expect(new Set(out.filter((_, k) => k % 2 === 1))).toEqual(new Set(['d1', 'd2', 'd3']));
  });

  it('plays a single deck alone, and nothing without any', () => {
    expect(buildListeningBossQuestions([[], [q('d1')]], 3, () => 0.5).map((x) => x.exerciseId)).toEqual(['d1', 'd1', 'd1']);
    expect(buildListeningBossQuestions([[], []], 3, () => 0.5)).toEqual([]);
  });
});
