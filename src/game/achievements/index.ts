import type { Achievement, AchievementModule, AchievementStats } from './types';

export type { Achievement, AchievementStats } from './types';
export { achievementStats } from './stats';

const modules = import.meta.glob<AchievementModule>('./badges/*.ts', { eager: true });

/** Gallery order; a badge file not listed here still counts and is shown after these. */
const ORDER = ['premiere-seance', 'flamme', 'bonnes-reponses', 'combo', 'sans-faute', 'accents', 'sauveteur', 'oiseau-de-nuit', 'leve-tot', 'maitrise', 'premiere-ecoute', 'oreille-fine', 'sans-sous-titres', 'oreille-d-or'];
const rank = (file: string) => {
  const i = ORDER.indexOf(file.replace(/^.*\/|\.ts$/g, ''));
  return i < 0 ? ORDER.length : i;
};

/** Every badge file in `badges/`: adding a badge is adding a file. */
export const BADGES: readonly Achievement[] = Object.keys(modules)
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  .flatMap((file) => [modules[file]!.default].flat());

/** One badge per unit with a boss, generated from the content. */
export function bossAchievements(units: readonly { key: string; title: string }[]): Achievement[] {
  return units.map((unit) => ({
    id: `boss-${unit.key}`,
    title: `Vainqueur : ${unit.title}`,
    description: { pl: `Pokonaj bossa jednostki „${unit.title}”.`, fr: `Bats le boss de l’unité « ${unit.title} ».` },
    icon: '🐉',
    check: (s: AchievementStats) => s.defeatedBosses.has(unit.key),
  }));
}

export const unlockedIds = (achievements: readonly Achievement[], stats: AchievementStats) =>
  new Set(achievements.filter((a) => a.check(stats)).map((a) => a.id));
