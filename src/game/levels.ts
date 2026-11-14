import { GAME } from './config';

/** XP needed to go from level `n` to `n + 1`. */
export const xpForLevel = (n: number) => Math.round(GAME.level.base * n ** GAME.level.exponent);

export interface LevelInfo {
  level: number;
  title: string;
  /** XP earned since reaching this level. */
  intoLevel: number;
  /** XP still missing to the next level. */
  toNext: number;
  /** XP between this level and the next (`intoLevel + toNext`). */
  span: number;
}

export function levelTitle(level: number): string {
  const titles = GAME.level.titles;
  return titles[Math.min(level, titles.length) - 1]!;
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let floor = 0;
  while (xp >= floor + xpForLevel(level)) {
    floor += xpForLevel(level);
    level += 1;
  }
  const span = xpForLevel(level);
  return { level, title: levelTitle(level), intoLevel: xp - floor, toNext: floor + span - xp, span };
}
