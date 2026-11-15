import { AppLayout, MenuButton } from '../components/AppLayout';
import { Emoji } from '../components/Emoji';
import { GameBar } from '../components/GameBar';
import { LevelNotice } from '../components/LevelNotice';
import { QuestList } from '../components/QuestList';
import { SyncBadge } from '../components/SyncBadge';
import { Icon } from '../components/Icon';
import { LangSwitch } from '../components/LangSwitch';
import { Mark } from '../components/Mark';
import { content } from '../content/registry';
import { GAME } from '../game/config';
import { ui } from '../i18n/ui';
import { dayKey } from '../lib/date';
import { newIntroducedOn } from '../lib/progress/fold';
import type { SessionItem } from '../lib/session';
import { cardKey, isDue, type Skill } from '../lib/srs';
import { QuietToggle } from '../components/QuietToggle';
import { useQuiet } from '../state/quiet';
import { buildReviewSession, buildUnitSession, NEW_PER_DAY } from '../sessions';
import { useAppStore } from '../state/appStore';
import { useLeague, useMapState } from '../state/useGame';
import { TIER_ICONS } from './League';

interface Props {
  onStart: (title: string, items: SessionItem[], unitKey?: string) => void;
  onOpenSheets: () => void;
  onOpenSheet: (key: string) => void;
  onOpenSettings: () => void;
  onOpenPack: (packId: string) => void;
  onOpenAchievements: () => void;
  onOpenLeague: () => void;
  onOpenStats: () => void;
}

export function Home({ onStart, onOpenSheets, onOpenSheet, onOpenSettings, onOpenPack, onOpenAchievements, onOpenLeague, onOpenStats }: Props) {
  const progress = useAppStore((s) => s.progress);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const map = useMapState();
  const league = useLeague();
  const cards = progress.cards;
  const today = dayKey(new Date());
  const { quiet } = useQuiet();
  const dueOf = (skill: Skill) =>
    [...content.entries.values()].filter((e) => !e.deprecated && cards[cardKey(e.id, skill)] && isDue(cards[cardKey(e.id, skill)]!, today)).length;
  const dueCount = dueOf('written');
  const dueListening = dueOf('listening');
  const dueSpeaking = dueOf('speaking');
  const review = () => buildReviewSession(progress, settings, { quiet });
  const reviewSize = review().length;
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
              <Mark className="logo-mark" />
              {ui.appTitle}
            </h1>
            <p className="subtitle">{ui.appSubtitle}</p>
          </div>
          <div className="header-actions">
            <SyncBadge />
            <QuietToggle />
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
        <LevelNotice />

        <section className="review-card">
          <div>
            <p className="big-number">{dueCount}</p>
            <p className="muted">{ui.dueCount(dueCount)}</p>
            <p className="muted small">{ui.newToday(newIntroducedOn(progress, today), NEW_PER_DAY)}</p>
            {(dueListening > 0 || dueSpeaking > 0) && (
              <p className={`muted small${quiet ? ' skill-waiting' : ''}`}>
                {[dueListening > 0 && ui.dueListening(dueListening), dueSpeaking > 0 && ui.dueSpeaking(dueSpeaking)].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <button className="button primary big" disabled={reviewSize === 0} onClick={() => onStart(ui.review, review())}>
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

        <section className="pack-tiles-section">
          <h2>{ui.modules}</h2>
          <div className="pack-tiles">
            {exercisePacks.map((pack) => {
              const state = map.get(pack.id)!;
              const opened = state.units.filter((u) => u.total > 0 && u.seen === u.total).length;
              const fading = state.units.filter((u) => u.refresh.length).length;
              const due = pack.unitList
                .flatMap((u) => u.entryIds)
                .filter((id) => cards[cardKey(id)] && isDue(cards[cardKey(id)]!, today)).length;
              return (
                <button key={pack.id} className={state.locked ? 'pack-tile locked' : 'pack-tile'} onClick={() => onOpenPack(pack.id)}>
                  <span className="pack-tile-icon">
                    <Emoji char={pack.icon} />
                  </span>
                  <span className="pack-tile-title">{pack.title}</span>
                  <span className="level">{pack.level}</span>
                  <span className="progress" aria-hidden>
                    <span style={{ width: `${(100 * opened) / state.units.length}%` }} />
                  </span>
                  <span className="muted small">
                    {state.locked ? (
                      <>
                        <Icon name="lock" /> {ui.locked}
                      </>
                    ) : (
                      <>
                        {ui.unitsDone(opened, state.units.length)}
                        {due ? ` · ${ui.unitDue(due)}` : ''}
                        {fading ? ` · ${ui.unitsToRefresh(fading)}` : ''}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
            <p className="pack-tile more">
              <Icon name="more" /> {ui.moreSoon}
            </p>
          </div>
        </section>

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
