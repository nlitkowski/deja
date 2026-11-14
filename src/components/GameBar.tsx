import { ui } from '../i18n/ui';
import { useGame } from '../state/useGame';
import { Emoji } from './Emoji';

const RING = 2 * Math.PI * 26;

/** Daily goal ring, streak flame and level: the three things that say "keep going" on Home. */
export function GameBar() {
  const { level, streak } = useGame();
  const goalShare = Math.min(1, streak.todayXp / streak.goal);

  return (
    <section className="game-bar">
      <div className={streak.todayDone ? 'goal-ring done' : 'goal-ring'} role="img" aria-label={ui.goalLabel(streak.todayXp, streak.goal)}>
        <svg viewBox="0 0 64 64" aria-hidden>
          <circle className="goal-ring-track" cx="32" cy="32" r="26" />
          <circle className="goal-ring-fill" cx="32" cy="32" r="26" strokeDasharray={RING} strokeDashoffset={RING * (1 - goalShare)} />
        </svg>
        <span className="goal-ring-text" aria-hidden>
          <strong>{streak.todayXp}</strong>
          <small>/{streak.goal}</small>
        </span>
      </div>

      <div className={streak.current ? 'flame lit' : 'flame'} role="img" aria-label={ui.streakLabel(streak.current)}>
        <span className="flame-icon" aria-hidden>
          <Emoji char="🔥" />
        </span>
        <span aria-hidden>
          <strong>{streak.current}</strong> <span className="muted small">{ui.streakDays(streak.current)}</span>
        </span>
        {streak.freezes > 0 && (
          <span className="freezes" title={ui.freezesLabel(streak.freezes)}>
            <Emoji char="🧊" />
            <span className="visually-hidden">{ui.freezesLabel(streak.freezes)}</span>
            <span aria-hidden>×{streak.freezes}</span>
          </span>
        )}
      </div>

      <div className="level-box" role="img" aria-label={ui.levelLabel(level.level, level.title, level.toNext)}>
        <span className="level-name" aria-hidden>
          <strong>{ui.level(level.level)}</strong> · {level.title}
        </span>
        <span className="progress" aria-hidden>
          <span style={{ width: `${(level.intoLevel / level.span) * 100}%` }} />
        </span>
        <span className="muted small" aria-hidden>
          {ui.xpToNext(level.toNext)}
        </span>
      </div>
    </section>
  );
}
