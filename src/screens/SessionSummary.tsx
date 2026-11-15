import { useEffect, useState } from 'react';
import { QuestList } from '../components/QuestList';
import { celebrate } from '../confetti';
import { levelFromXp } from '../game/levels';
import { streakInfo } from '../game/streak';
import { sessionXp, totalXp } from '../game/xp';
import { ui } from '../i18n/ui';
import { addDays, dayKey } from '../lib/date';
import { newIntroducedOn } from '../lib/progress/fold';
import { skillOfKey } from '../lib/srs';
import { NEW_PER_DAY } from '../sessions';
import { acknowledgeLevel, isNewLevel } from '../state/levelMemory';
import { sfx } from '../sfx';
import { useAppStore } from '../state/appStore';
import { xpContext } from '../xpContext';
import type { SessionOutcome } from './Session';

export function SessionSummary({ outcome, onDone }: { outcome: SessionOutcome; onDone: () => void }) {
  const log = useAppStore((s) => s.log);
  const sound = useAppStore((s) => s.settings.sound);
  // Computed once: the summary describes the session as it ended.
  const [view] = useState(() => {
    const xp = sessionXp(log, outcome.sessionId, xpContext);
    const after = totalXp(log, xpContext);
    return {
      xp,
      before: levelFromXp(after - xp.total),
      after: levelFromXp(after),
      streak: streakInfo(log, dayKey(new Date()), xpContext),
    };
  });
  // Levels already shown on this device (before a recalculation of the curve, say) are not celebrated again.
  const [levelledUp] = useState(() => view.after.level > view.before.level && isNewLevel(view.after.level));
  const [showLevelUp, setShowLevelUp] = useState(levelledUp);
  useEffect(() => acknowledgeLevel(view.after.level), [view.after.level]);
  const progress = useAppStore((s) => s.progress);
  const [dueTomorrow] = useState(() => {
    const today = dayKey(new Date());
    if (newIntroducedOn(progress, today) < NEW_PER_DAY) return undefined;
    const tomorrow = addDays(today, 1);
    return Object.entries(progress.cards).filter(([key, card]) => skillOfKey(key) === 'written' && card.due === tomorrow).length;
  });
  const [barFilled, setBarFilled] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setBarFilled(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const bossWon = !!outcome.boss?.defeated;
  useEffect(() => {
    if (!levelledUp && !bossWon) return;
    celebrate();
    if (sound) sfx.levelUp();
  }, [levelledUp, bossWon, sound]);

  const pct = outcome.answered ? Math.round((outcome.correct / outcome.answered) * 100) : 0;
  const tiles = [
    [`${pct} %`, ui.percentCorrect],
    [`${outcome.correct}/${outcome.answered}`, ui.answers],
    [String(outcome.entriesReviewed), ui.entriesReviewed],
    [String(outcome.nearMiss), ui.accentsMissed],
  ];
  const breakdown = [
    [ui.xpAnswers, view.xp.answers],
    [ui.xpCombo, view.xp.combo],
    [ui.xpBonus, view.xp.bonus],
  ] as const;

  // The bar grows from where the session started; after a level-up it starts from empty.
  const { after, before, streak } = view;
  const startShare = levelledUp ? 0 : before.intoLevel / before.span;
  const barShare = barFilled ? after.intoLevel / after.span : startShare;
  const goalShare = Math.min(1, streak.todayXp / streak.goal);

  return (
    <main className="screen summary">
      <h1>{outcome.boss ? (bossWon ? ui.bossWon : ui.bossLost) : ui.sessionDone}</h1>
      <p className="muted">{outcome.boss ? ui.bossOf(outcome.title) : outcome.title}</p>
      {outcome.boss && !bossWon && <p>{ui.bossRetry}</p>}

      <section className="xp-card">
        <p className="big-number">{ui.xpGain(view.xp.total)}</p>
        <dl className="xp-breakdown">
          {breakdown.map(([label, value]) => (
            <div key={label}>
              <dt className="muted small">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="level-box">
          <span className="level-name">
            <strong>{ui.level(after.level)}</strong> · {after.title}
          </span>
          <span className="progress level-progress">
            <span style={{ width: `${barShare * 100}%` }} />
          </span>
          <span className="muted small">{ui.xpToNext(after.toNext)}</span>
        </div>
      </section>

      <section className="xp-card goal-card">
        <span className="level-name">
          <strong>{ui.dailyGoal}</strong> · {streak.todayXp} / {streak.goal} XP
        </span>
        <span className="progress">
          <span style={{ width: `${goalShare * 100}%` }} />
        </span>
        {streak.todayDone && (
          <p className="streak-day">
            {ui.goalReached} · <strong>{ui.dayStreak(streak.current)}</strong>
          </p>
        )}
      </section>

      {dueTomorrow !== undefined && <p className="muted tomorrow">{ui.dueTomorrow(dueTomorrow)}</p>}

      <QuestList />

      <div className="summary-grid">
        {tiles.map(([value, label]) => (
          <div key={label}>
            <p className="big-number">{value}</p>
            <p className="muted small">{label}</p>
          </div>
        ))}
      </div>
      <button className="button primary big" onClick={onDone} autoFocus={!showLevelUp}>
        {ui.backToMap}
      </button>

      {showLevelUp && (
        <div className="level-up" role="dialog" aria-modal="true" aria-labelledby="level-up-title">
          <p className="level-up-kicker">{ui.levelUp}</p>
          <p id="level-up-title" className="level-up-level">
            {ui.level(after.level)}
          </p>
          <p className="level-up-title">{after.title}</p>
          <button className="button primary big" onClick={() => setShowLevelUp(false)} autoFocus>
            {ui.continue}
          </button>
        </div>
      )}
    </main>
  );
}
