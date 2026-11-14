import { Emoji } from '../components/Emoji';
import { Icon } from '../components/Icon';
import { GAME } from '../game/config';
import { ui } from '../i18n/ui';
import { useLeague } from '../state/useGame';

export const TIER_ICONS = ['🥉', '🥈', '🥇', '💎'];

export function League({ onBack }: { onBack: () => void }) {
  const league = useLeague();
  const tierName = GAME.league.tiers[league.tier]!;
  const size = league.rows.length;

  return (
    <main className="screen league">
      <header className="top-bar">
        <button className="back-button" onClick={onBack}>
          <Icon name="back" /> {ui.back}
        </button>
      </header>
      <h1>
        <Emoji char={TIER_ICONS[league.tier]!} /> {ui.leagueTier(tierName)}
      </h1>
      <p className="muted">{ui.daysLeft(league.daysLeft)}</p>

      <ol className="league-table">
        {league.rows.map((row, i) => {
          const place = i + 1;
          const zone = place <= GAME.league.promote ? 'up' : place > size - GAME.league.relegate ? 'down' : '';
          const name = row.kind === 'you' ? ui.you : row.kind === 'ghost' ? ui.ghost(row.weeksAgo!) : row.name!;
          return (
            <li key={row.id} className={`league-row ${row.kind} ${zone}`}>
              <span className="league-place">{ui.rank(place)}</span>
              <span className="league-avatar" aria-hidden>
                <Emoji char={row.kind === 'you' ? '🙂' : row.kind === 'ghost' ? '👻' : '🤖'} />
              </span>
              <span className="league-name">{name}</span>
              <span className="league-xp">{row.xp} XP</span>
              {zone && <span className="visually-hidden">{zone === 'up' ? ui.promoteZone : ui.relegateZone}</span>}
            </li>
          );
        })}
      </ol>
      <p className="muted small">{ui.leagueHint}</p>
    </main>
  );
}
