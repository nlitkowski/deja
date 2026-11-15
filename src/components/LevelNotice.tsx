import { useState } from 'react';
import { ui } from '../i18n/ui';
import { acknowledgeLevel, levelsRecalculated } from '../state/levelMemory';
import { useGame } from '../state/useGame';

/** Once, after the level curve changed: the same XP now makes a different level, and that is not a loss. */
export function LevelNotice() {
  const { xp, level } = useGame();
  const [open, setOpen] = useState(() => levelsRecalculated(xp));
  if (!open) return null;
  const close = () => {
    acknowledgeLevel(level.level);
    setOpen(false);
  };
  return (
    <section className="level-notice" role="status">
      <p>{ui.levelsRecalculated(level.level, level.title)}</p>
      <button className="button" onClick={close}>
        {ui.ok}
      </button>
    </section>
  );
}
