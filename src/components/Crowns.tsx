import type { Mastery } from '../game/mastery';
import { Icon } from './Icon';

/** Five crowns: full up to the current level, faded up to the peak the unit once had, empty above. */
export function Crowns({ mastery, peak, small = false }: { mastery: Mastery; peak: Mastery; small?: boolean }) {
  return (
    <span className={small ? 'crowns small' : 'crowns'} aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= mastery ? 'crown on' : n <= peak ? 'crown faded' : 'crown'}>
          <Icon name="crown" />
        </span>
      ))}
    </span>
  );
}
