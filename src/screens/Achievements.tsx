import { Emoji } from '../components/Emoji';
import { Icon } from '../components/Icon';
import { ui } from '../i18n/ui';
import { useAppStore } from '../state/appStore';
import { ACHIEVEMENTS, useAchievements } from '../state/useGame';

/** The badge gallery: earned ones in colour, the rest as grey silhouettes with what earns them. */
export function Achievements({ onBack }: { onBack: () => void }) {
  const helpLang = useAppStore((s) => s.settings.helpLang);
  const { stats, unlocked } = useAchievements();

  return (
    <main className="screen achievements">
      <header className="top-bar">
        <button className="back-button" onClick={onBack}>
          <Icon name="back" /> {ui.back}
        </button>
      </header>
      <h1>{ui.achievements}</h1>
      <p className="muted">{ui.achievementsCount(unlocked.size, ACHIEVEMENTS.length)}</p>
      <ul className="badge-grid">
        {ACHIEVEMENTS.map((badge) => {
          const earned = unlocked.has(badge.id);
          const progress = !earned && badge.progress?.(stats);
          return (
            <li key={badge.id} className={earned ? 'badge earned' : 'badge'}>
              <span className="badge-icon" aria-hidden>
                <Emoji char={badge.icon} />
              </span>
              <strong className="badge-title">{badge.title}</strong>
              <span className="muted small" lang={helpLang}>
                {badge.description[helpLang]}
              </span>
              {progress && (
                <span className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress[1]} aria-valuenow={progress[0]} aria-label={badge.title}>
                  <span style={{ width: `${(progress[0] / progress[1]) * 100}%` }} />
                </span>
              )}
              <span className="visually-hidden">{earned ? ui.earned : ui.notEarned}</span>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
