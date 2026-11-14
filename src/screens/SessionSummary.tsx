import { ui } from '../i18n/ui';
import type { SessionOutcome } from './Session';

export function SessionSummary({ outcome, onDone }: { outcome: SessionOutcome; onDone: () => void }) {
  const pct = outcome.answered ? Math.round((outcome.correct / outcome.answered) * 100) : 0;
  const tiles = [
    [`${pct} %`, ui.percentCorrect],
    [`${outcome.correct}/${outcome.answered}`, ui.answers],
    [String(outcome.entriesReviewed), ui.entriesReviewed],
    [String(outcome.nearMiss), ui.accentsMissed],
  ];
  return (
    <main className="screen summary">
      <h1>{ui.sessionDone}</h1>
      <p className="muted">{outcome.title}</p>
      <div className="summary-grid">
        {tiles.map(([value, label]) => (
          <div key={label}>
            <p className="big-number">{value}</p>
            <p className="muted small">{label}</p>
          </div>
        ))}
      </div>
      <button className="button primary big" onClick={onDone} autoFocus>
        {ui.backToMap}
      </button>
    </main>
  );
}
