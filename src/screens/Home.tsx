import { allEntries, content } from '../content/registry';
import { HELP_LANGS } from '../content/localized';
import { isProduction, supportsHelpLang } from '../exercises/registry';
import { ui } from '../i18n/ui';
import { dayKey } from '../lib/date';
import { buildSession, type SessionItem } from '../lib/session';
import { isDue } from '../lib/srs';
import type { SavedState } from '../lib/storage';

export const NEW_PER_DAY = 5;
const NEW_PER_UNIT_SESSION = 5;

interface Props {
  state: SavedState;
  update: (fn: (s: SavedState) => SavedState) => void;
  onStart: (title: string, items: SessionItem[]) => void;
}

export function Home({ state, update, onStart }: Props) {
  const today = dayKey(new Date());
  const { helpLang } = state.settings;
  const entries = allEntries();
  const exercises = [...content.exercises.values()].filter((ex) => supportsHelpLang(ex.type, helpLang));
  const dueCount = entries.filter((e) => !e.deprecated && state.srs[e.id] && isDue(state.srs[e.id]!, today)).length;
  const newLeft = Math.max(0, NEW_PER_DAY - state.daily.newIntroduced);

  const reviewItems = () =>
    buildSession({ entries, exercises, srs: state.srs, today, newAllowed: newLeft, isProduction, mode: 'review' });
  const reviewSize = reviewItems().length;

  function startUnit(unitKey: string) {
    const unit = content.units.get(unitKey)!;
    const items = buildSession({
      entries: unit.entryIds.map((id) => content.entries.get(id)!),
      exercises: exercises.filter((ex) => ex.unitId === unitKey),
      srs: state.srs,
      today,
      newAllowed: NEW_PER_UNIT_SESSION,
      isProduction,
      mode: 'practice',
    });
    onStart(unit.title, items);
  }

  return (
    <main className="screen home">
      <header className="home-header">
        <h1>{ui.appTitle}</h1>
        <p className="subtitle">{ui.appSubtitle}</p>
      </header>

      <section className="review-card">
        <div>
          <p className="big-number">{dueCount}</p>
          <p className="muted">{ui.dueCount(dueCount)}</p>
          <p className="muted small">{ui.newToday(state.daily.newIntroduced, NEW_PER_DAY)}</p>
        </div>
        <button className="button primary big" disabled={reviewSize === 0} onClick={() => onStart(ui.review, reviewItems())}>
          {reviewSize === 0 ? ui.allDoneToday : ui.reviewWithCount(reviewSize)}
        </button>
      </section>

      <div className="segmented" role="radiogroup" aria-label={ui.helpLangLabel}>
        <span className="segmented-label">{ui.helpLangLabel}</span>
        {HELP_LANGS.map((lang) => (
          <button
            key={lang}
            role="radio"
            aria-checked={helpLang === lang}
            className={helpLang === lang ? 'active' : ''}
            onClick={() => update((s) => ({ ...s, settings: { ...s.settings, helpLang: lang } }))}
          >
            {ui.helpLangNames[lang]}
          </button>
        ))}
      </div>

      {content.packs.map((pack) => (
        <section key={pack.id} className="pack">
          <h2>
            <span aria-hidden>{pack.icon}</span> {pack.title} <span className="level">{pack.level}</span>
          </h2>
          <ol className="unit-list">
            {pack.unitList.map((unit) => {
              const total = unit.entryIds.length;
              const seen = unit.entryIds.filter((id) => state.srs[id]).length;
              const due = unit.entryIds.filter((id) => state.srs[id] && isDue(state.srs[id]!, today)).length;
              return (
                <li key={unit.key}>
                  <button className="unit" onClick={() => startUnit(unit.key)}>
                    <span className="unit-icon" aria-hidden>{unit.icon}</span>
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
                    <span className="chevron" aria-hidden>›</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </main>
  );
}
