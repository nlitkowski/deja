import { LangSwitch } from '../components/LangSwitch';
import { content } from '../content/registry';
import { ui } from '../i18n/ui';
import { dayKey } from '../lib/date';
import type { SessionItem } from '../lib/session';
import { isDue } from '../lib/srs';
import type { SavedState } from '../lib/storage';
import { buildReviewSession, buildUnitSession, NEW_PER_DAY } from '../sessions';
import { Icon } from '../components/Icon';
import { Emoji } from '../components/Emoji';

interface Props {
  state: SavedState;
  update: (fn: (s: SavedState) => SavedState) => void;
  onStart: (title: string, items: SessionItem[]) => void;
  onOpenSheets: () => void;
  onOpenSettings: () => void;
}

export function Home({ state, update, onStart, onOpenSheets, onOpenSettings }: Props) {
  const today = dayKey(new Date());
  const dueCount = [...content.entries.values()].filter((e) => !e.deprecated && state.srs[e.id] && isDue(state.srs[e.id]!, today)).length;
  const reviewSize = buildReviewSession(state).length;
  const sheetCount = content.sheets.size;
  const exercisePacks = content.packs.filter((p) => p.unitList.length);

  return (
    <main className="screen home">
      <header className="home-header">
        <div>
          <h1 className="logotype">
            <img className="logo-mark" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={36} height={36} />
            {ui.appTitle}
          </h1>
          <p className="subtitle">{ui.appSubtitle}</p>
        </div>
        <div className="header-actions">
          <LangSwitch value={state.settings.helpLang} onChange={(helpLang) => update((s) => ({ ...s, settings: { ...s.settings, helpLang } }))} />
          <button className="icon-button settings-button" onClick={onOpenSettings} aria-label={ui.settings} title={ui.settings}>
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <section className="review-card">
        <div>
          <p className="big-number">{dueCount}</p>
          <p className="muted">{ui.dueCount(dueCount)}</p>
          <p className="muted small">{ui.newToday(state.daily.newIntroduced, NEW_PER_DAY)}</p>
        </div>
        <button className="button primary big" disabled={reviewSize === 0} onClick={() => onStart(ui.review, buildReviewSession(state))}>
          {reviewSize === 0 ? ui.allDoneToday : ui.reviewWithCount(reviewSize)}
        </button>
      </section>

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
          <ol className="unit-list">
            {pack.unitList.map((unit) => {
              const total = unit.entryIds.length;
              const seen = unit.entryIds.filter((id) => state.srs[id]).length;
              const due = unit.entryIds.filter((id) => state.srs[id] && isDue(state.srs[id]!, today)).length;
              return (
                <li key={unit.key}>
                  <button className="unit" onClick={() => onStart(unit.title, buildUnitSession(state, unit.key))}>
                    <span className="unit-icon">
                      <Emoji char={unit.icon} />
                    </span>
                    <span className="unit-body">
                      <span className="unit-title">{unit.title}</span>
                      <span className="progress" aria-label={ui.unitProgressLabel(seen, total)}>
                        <span style={{ width: `${(seen / total) * 100}%` }} />
                      </span>
                      <span className="muted small">
                        {ui.unitSeen(seen, total)}
                        {due ? ` · ${ui.unitDue(due)}` : ''}
                      </span>
                    </span>
                    <span className="chevron" aria-hidden>
                      <Icon name="next" />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <footer className="disclaimer muted small">{ui.disclaimer}</footer>
    </main>
  );
}
