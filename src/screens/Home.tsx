import { AppLayout, MenuButton } from '../components/AppLayout';
import { Emoji } from '../components/Emoji';
import { GameBar } from '../components/GameBar';
import { QuestList } from '../components/QuestList';
import { UnitMap } from '../components/UnitMap';
import { Icon } from '../components/Icon';
import { LangSwitch } from '../components/LangSwitch';
import { content } from '../content/registry';
import { GAME } from '../game/config';
import { ui } from '../i18n/ui';
import { dayKey } from '../lib/date';
import { newIntroducedOn } from '../lib/progress/fold';
import type { SessionItem } from '../lib/session';
import { isDue } from '../lib/srs';
import { buildReviewSession, buildUnitSession, NEW_PER_DAY } from '../sessions';
import { useAppStore } from '../state/appStore';
import { useLeague, useMapState } from '../state/useGame';
import { TIER_ICONS } from './League';

interface Props {
  onStart: (title: string, items: SessionItem[], unitKey?: string) => void;
  onOpenSheets: () => void;
  onOpenSheet: (key: string) => void;
  onOpenSettings: () => void;
  onBoss: (unitKey: string) => void;
  onOpenAchievements: () => void;
  onOpenLeague: () => void;
  onOpenStats: () => void;
}

export function Home({ onStart, onOpenSheets, onOpenSheet, onOpenSettings, onBoss, onOpenAchievements, onOpenLeague, onOpenStats }: Props) {
  const progress = useAppStore((s) => s.progress);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const map = useMapState();
  const league = useLeague();
  const cards = progress.cards;
  const today = dayKey(new Date());
  const dueCount = [...content.entries.values()].filter((e) => !e.deprecated && cards[e.id] && isDue(cards[e.id]!, today)).length;
  const reviewSize = buildReviewSession(progress, settings).length;
  const sheetCount = content.sheets.size;
  const exercisePacks = content.packs.filter((p) => p.unitList.length);
  const practice = (unitKey: string) => onStart(content.units.get(unitKey)?.title ?? '', buildUnitSession(progress, settings, unitKey), unitKey);

  return (
    <AppLayout onOpenSheet={onOpenSheet} onPractice={practice}>
      <div className="home">
        <header className="home-header">
          <MenuButton />
          <div className="home-title">
            <h1 className="logotype">
              <img className="logo-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={36} height={36} />
              {ui.appTitle}
            </h1>
            <p className="subtitle">{ui.appSubtitle}</p>
          </div>
          <div className="header-actions">
            <LangSwitch value={settings.helpLang} onChange={(helpLang) => updateSettings({ helpLang })} />
            <button className="icon-button" onClick={onOpenAchievements} aria-label={ui.achievements} title={ui.achievements}>
              <Icon name="trophy" />
            </button>
            <button className="icon-button settings-button" onClick={onOpenSettings} aria-label={ui.settings} title={ui.settings}>
              <Icon name="settings" />
            </button>
          </div>
        </header>

        <GameBar />

        <section className="review-card">
          <div>
            <p className="big-number">{dueCount}</p>
            <p className="muted">{ui.dueCount(dueCount)}</p>
            <p className="muted small">{ui.newToday(newIntroducedOn(progress, today), NEW_PER_DAY)}</p>
          </div>
          <button className="button primary big" disabled={reviewSize === 0} onClick={() => onStart(ui.review, buildReviewSession(progress, settings))}>
            {reviewSize === 0 ? ui.allDoneToday : ui.reviewWithCount(reviewSize)}
          </button>
        </section>

        <QuestList />

        <div className="home-links">
          <button className="sheets-card" onClick={onOpenLeague}>
            <span className="sheets-card-icon">
              <Emoji char={TIER_ICONS[league.tier]!} />
            </span>
            <span className="unit-body">
              <span className="unit-title">{ui.league}</span>
              <span className="muted small">{ui.leagueSummary(GAME.league.tiers[league.tier]!, ui.rank(league.rank))}</span>
            </span>
          </button>
          <button className="sheets-card" onClick={onOpenStats}>
            <span className="sheets-card-icon">
              <Emoji char="📊" />
            </span>
            <span className="unit-body">
              <span className="unit-title">{ui.stats}</span>
              <span className="muted small">{ui.statsTeaser}</span>
            </span>
          </button>
        </div>

        {sheetCount > 0 && (
          <button className="sheets-card" onClick={onOpenSheets}>
            <span className="sheets-card-icon">
              <Emoji char="📖" />
            </span>
            <span className="unit-body">
              <span className="unit-title">{ui.sheets}</span>
              <span className="muted small">{ui.sheetsTeaser(sheetCount)}</span>
            </span>
            <span className="chevron" aria-hidden>
              <Icon name="next" />
            </span>
          </button>
        )}

        {exercisePacks.map((pack) => (
          <section key={pack.id} className="pack">
            <h2>
              <Emoji char={pack.icon} /> {pack.title} <span className="level">{pack.level}</span>
            </h2>
            <UnitMap pack={pack} state={map.get(pack.id)!} onPractice={practice} onBoss={onBoss} />
          </section>
        ))}

        <footer className="disclaimer muted small">
          <p>{ui.disclaimer}</p>
          <p>
            {ui.madeBy}{' '}
            <a href="https://litkowski.com" target="_blank" rel="noopener noreferrer">
              litkowski.com
            </a>
          </p>
        </footer>
      </div>
    </AppLayout>
  );
}
