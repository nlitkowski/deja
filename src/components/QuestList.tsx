import { ui } from '../i18n/ui';
import { sfx } from '../sfx';
import { useAppStore } from '../state/appStore';
import { useQuests } from '../state/useGame';
import { Emoji } from './Emoji';

/** Today's quests and the week's one, with their rewards to claim. */
export function QuestList() {
  const quests = useQuests();
  const claimQuest = useAppStore((s) => s.claimQuest);
  const sound = useAppStore((s) => s.settings.sound);

  function claim(questId: string, period: string, xp: number) {
    if (claimQuest({ questId, period, xp }) && sound) sfx.correct(8);
  }

  return (
    <section className="quests" aria-labelledby="quests-title">
      <h2 id="quests-title">{ui.quests}</h2>
      <ul>
        {quests.map(({ quest, period, progress, target, done, claimed, reward }) => (
          <li key={`${quest.id}@${period}`} className={claimed ? 'quest claimed' : done ? 'quest done' : 'quest'}>
            <span className="quest-icon" aria-hidden>
              <Emoji char={quest.icon} />
            </span>
            <span className="quest-body">
              <span className="quest-title">
                {quest.title}
                {quest.period === 'week' && <span className="level">{ui.weekly}</span>}
              </span>
              <span className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={progress} aria-label={quest.title}>
                <span style={{ width: `${(progress / target) * 100}%` }} />
              </span>
            </span>
            {done && !claimed ? (
              <button className="button primary quest-claim" onClick={() => claim(quest.id, period, reward)}>
                {ui.claim(reward)}
              </button>
            ) : (
              <span className="quest-count muted small">{claimed ? ui.claimed : `${progress}/${target}`}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
