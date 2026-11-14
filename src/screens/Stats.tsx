import { Emoji } from '../components/Emoji';
import { Icon } from '../components/Icon';
import { content } from '../content/registry';
import { ui } from '../i18n/ui';
import { useAppStore } from '../state/appStore';
import { useStats } from '../state/useGame';

interface Props {
  onBack: () => void;
  onReviseWeak: (entryIds: string[]) => void;
}

export function Stats({ onBack, onReviseWeak }: Props) {
  const { heatmap, weakest, mastery } = useStats();
  const cards = useAppStore((s) => s.progress.cards);
  const helpLang = useAppStore((s) => s.settings.helpLang);

  return (
    <main className="screen stats">
      <header className="top-bar">
        <button className="back-button" onClick={onBack}>
          <Icon name="back" /> {ui.back}
        </button>
      </header>
      <h1>{ui.stats}</h1>

      <section className="settings-card">
        <h2>{ui.activity}</h2>
        <div className="heatmap-scroll">
          <div className="heatmap">
            {heatmap.map((week) => (
              <div key={week[0]!.day} className="heat-week">
                {week.map((d) => (
                  <span key={d.day} className={`heat-day level-${d.level}`} title={ui.heatDay(d.day, d.xp)} />
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="heat-legend muted small">
          {ui.heatLegend.map((label, level) => (
            <span key={label}>
              <span className={`heat-day level-${level}`} aria-hidden /> {label}
            </span>
          ))}
        </p>
      </section>

      <section className="settings-card">
        <div className="section-head">
          <h2>{ui.weakest}</h2>
          {weakest.length > 0 && (
            <button className="button primary" onClick={() => onReviseWeak(weakest)}>
              {ui.reviseWeak}
            </button>
          )}
        </div>
        {weakest.length === 0 ? (
          <p className="muted">{ui.weakestEmpty}</p>
        ) : (
          <ol className="weak-list">
            {weakest.map((id) => {
              const entry = content.entries.get(id)!;
              const card = cards[id]!;
              return (
                <li key={id}>
                  <span>
                    <strong lang="fr">{entry.fr}</strong>{' '}
                    <span className="muted" lang={helpLang}>
                      {helpLang === 'fr' ? (entry.def ?? entry.pl) : entry.pl}
                    </span>
                  </span>
                  <span className="muted small">{ui.mistakes(card.lapses)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="settings-card">
        <h2>{ui.masteryByPack}</h2>
        {content.packs
          .filter((p) => mastery.has(p.id))
          .map((pack) => {
            const counts = mastery.get(pack.id)!;
            const total = counts.reduce((a, b) => a + b, 0);
            return (
              <div key={pack.id} className="pack-mastery">
                <p>
                  <Emoji char={pack.icon} /> {pack.title} <span className="level">{pack.level}</span>
                </p>
                <span className="mastery-bar" role="img" aria-label={counts.map((n, level) => `${ui.masteryLevels[level]} : ${n}`).join(', ')}>
                  {counts.map((n, level) => (n ? <span key={level} className={`mastery-${level}`} style={{ flexGrow: n / total }} /> : null))}
                </span>
              </div>
            );
          })}
        <p className="heat-legend muted small">
          {ui.masteryLevels.map((label, level) => (
            <span key={label}>
              <span className={`swatch mastery-${level}`} aria-hidden /> {label}
            </span>
          ))}
        </p>
      </section>
    </main>
  );
}
