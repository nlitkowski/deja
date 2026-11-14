import { content } from '../content/registry';
import type { Pack } from '../content/schema';
import type { PackState } from '../game/map';
import { ui } from '../i18n/ui';
import { dayKey } from '../lib/date';
import { cardKey, isDue } from '../lib/srs';
import { useAppStore } from '../state/appStore';
import { Emoji } from './Emoji';
import { Icon } from './Icon';

/** Horizontal position of each step, in % of the width: a gentle zigzag, like a path on a game map. */
const ZIGZAG = [50, 78, 50, 22];
const UNIT_STEP = 150;
const BOSS_STEP = 96;
const MORE_STEP = 110;
const NODE_CENTER = 36;

function layout<S extends { height: number }>(steps: S[]) {
  const placed: (S & { top: number; x: number })[] = [];
  let top = 0;
  for (const [i, step] of steps.entries()) {
    placed.push({ ...step, top, x: ZIGZAG[i % ZIGZAG.length]! });
    top += step.height;
  }
  return { placed, height: top };
}

interface Props {
  pack: Pack;
  state: PackState;
  onPractice: (unitKey: string) => void;
  onBoss: (unitKey: string) => void;
  /** Continue the path to a "more modules coming" marker; set on the last pack. */
  more?: boolean;
}

/** The pack as a path: each unit, then its boss. Locks and crowns come from the learner's mastery. */
export function UnitMap({ pack, state, onPractice, onBoss, more }: Props) {
  const cards = useAppStore((s) => s.progress.cards);
  const today = dayKey(new Date());

  const steps = pack.unitList.flatMap((unit, i) => {
    const unitState = state.units[i]!;
    return [
      { kind: 'unit' as const, unit, unitState, height: UNIT_STEP },
      { kind: 'boss' as const, unit, unitState, height: BOSS_STEP },
    ];
  });
  const { placed, height: pathHeight } = layout(steps);
  const end = { top: pathHeight, x: ZIGZAG[placed.length % ZIGZAG.length]! };
  const height = more ? pathHeight + MORE_STEP : pathHeight;
  const points = [...placed, ...(more ? [end] : [])].map((s) => `${s.x},${s.top + NODE_CENTER}`).join(' ');
  const missing = state.missing.map((id) => content.packs.find((p) => p.id === id)?.title ?? id).join(', ');

  return (
    <div className={state.locked ? 'unit-map locked' : 'unit-map'}>
      {state.locked && (
        <p className="map-lock muted small">
          <Icon name="lock" /> {ui.packLocked(missing)}
        </p>
      )}
      <div className="map-path" style={{ height }}>
        <svg className="map-line" viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" aria-hidden>
          <polyline points={points} vectorEffect="non-scaling-stroke" />
        </svg>
        <ol>
          {placed.map((step, i) => {
            const { unit, unitState: u } = step;
            const previous = pack.unitList[pack.unitList.indexOf(unit) - 1];
            const style = { top: step.top, left: `${step.x}%` };
            if (step.kind === 'boss') {
              const open = u.boss.unlocked;
              const label = open ? ui.bossLabel(unit.title) : ui.bossLocked(unit.title);
              return (
                <li key={`boss-${unit.key}`} className="map-step boss-step" style={style}>
                  <button
                    className={`map-node boss-node${open ? '' : ' locked'}${u.boss.defeated ? ' defeated' : ''}`}
                    disabled={!open}
                    onClick={() => onBoss(unit.key)}
                    aria-label={label}
                    title={label}
                  >
                    <Emoji char="🐉" />
                    {!open && (
                      <span className="node-lock">
                        <Icon name="lock" />
                      </span>
                    )}
                  </button>
                  {u.boss.defeated && <span className="map-caption small">{ui.bossDefeated}</span>}
                </li>
              );
            }
            const due = unit.entryIds.filter((id) => cards[cardKey(id)] && isDue(cards[cardKey(id)]!, today)).length;
            const lockedLabel = previous ? ui.unitLocked(unit.title, previous.title) : unit.title;
            return (
              <li key={unit.key} className="map-step unit-step" style={style} data-index={i}>
                <button
                  className={`map-node unit-node${u.locked ? ' locked' : ''}${u.golden ? ' golden' : ''}`}
                  disabled={u.locked}
                  onClick={() => onPractice(unit.key)}
                  aria-label={u.locked ? lockedLabel : `${unit.title}, ${ui.masteryLabel(u.mastery)}`}
                  title={u.locked ? lockedLabel : undefined}
                >
                  <Emoji char={unit.icon} />
                  {u.locked && (
                    <span className="node-lock">
                      <Icon name="lock" />
                    </span>
                  )}
                </button>
                <span className="crowns" aria-hidden>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={n <= u.mastery ? 'crown on' : 'crown'}>
                      <Icon name="crown" />
                    </span>
                  ))}
                </span>
                <span className="map-caption">
                  <span className="map-title">{unit.title}</span>
                  <span className="muted small">
                    {ui.unitSeen(u.seen, u.total)}
                    {due ? ` · ${ui.unitDue(due)}` : ''}
                  </span>
                  {u.golden && <span className="mastered-badge small">{ui.mastered}</span>}
                </span>
              </li>
            );
          })}
          {more && (
            <li className="map-step more-step" style={{ top: end.top, left: `${end.x}%` }}>
              <span className="map-node more-node" aria-hidden>
                <Icon name="more" />
              </span>
              <span className="map-caption muted small">{ui.moreSoon}</span>
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}
