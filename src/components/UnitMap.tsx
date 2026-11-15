import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { content } from '../content/registry';
import type { Pack } from '../content/schema';
import { gatingUnit, type PackState } from '../game/map';
import { ui } from '../i18n/ui';
import { dayKey } from '../lib/date';
import { cardKey, isDue } from '../lib/srs';
import { useAppStore } from '../state/appStore';
import { Crowns } from './Crowns';
import { Emoji } from './Emoji';
import { Icon } from './Icon';

/** Horizontal position of each node, in % of the width: a gentle zigzag, like a path on a game map. */
const ZIGZAG = [50, 66, 50, 34];

/** "Unité 1 · Je suis…" → a label line and a title line, so a long title never wraps mid-phrase. */
function splitTitle(title: string): { label?: string; name: string } {
  const at = title.indexOf(' · ');
  return at < 0 ? { name: title } : { label: title.slice(0, at), name: title.slice(at + 3) };
}

/**
 * The dotted path, measured from the laid-out steps: from under each caption to the top of the next node,
 * so it never runs behind text.
 */
function usePathLine(ref: RefObject<HTMLDivElement | null>) {
  const [line, setLine] = useState<{ d: string; width: number; height: number }>();
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const box = root.getBoundingClientRect();
      const steps = [...root.querySelectorAll<HTMLElement>('.map-step')];
      const segments: string[] = [];
      let from: string | undefined;
      for (const step of steps) {
        const node = step.querySelector<HTMLElement>('.map-node')!.getBoundingClientRect();
        const x = Math.round(node.left + node.width / 2 - box.left);
        if (from) segments.push(`M${from}L${x},${Math.round(node.top - box.top - 6)}`);
        from = `${x},${Math.round(step.getBoundingClientRect().bottom - box.top + 4)}`;
      }
      setLine({ d: segments.join(''), width: box.width, height: box.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [ref]);
  return line;
}

interface Props {
  pack: Pack;
  state: PackState;
  onPractice: (unitKey: string) => void;
  onBoss: (unitKey: string, listening?: boolean) => void;
  /** Practise the entries that keep a unit's crown below its peak. */
  onRefresh: (unitKey: string, entryIds: string[]) => void;
  /** Continue the path to a "more modules coming" marker; set on the last pack. */
  more?: boolean;
}

/** The pack as a path: each unit, then its boss. Locks and crowns come from the learner's mastery. */
export function UnitMap({ pack, state, onPractice, onBoss, onRefresh, more }: Props) {
  const cards = useAppStore((s) => s.progress.cards);
  const today = dayKey(new Date());

  const pathRef = useRef<HTMLDivElement>(null);
  const line = usePathLine(pathRef);

  const steps = pack.unitList.flatMap((unit, i) => {
    const unitState = state.units[i]!;
    return [
      { kind: 'unit' as const, unit, unitState },
      { kind: 'boss' as const, unit, unitState },
    ];
  });
  const placed = steps.map((step, i) => ({ ...step, x: ZIGZAG[i % ZIGZAG.length]! }));
  const endX = ZIGZAG[placed.length % ZIGZAG.length]!;
  const missing = state.missing.map((id) => content.packs.find((p) => p.id === id)?.title ?? id).join(', ');

  return (
    <div className={state.locked ? 'unit-map locked' : 'unit-map'}>
      {state.locked && (
        <p className="map-lock muted small">
          <Icon name="lock" /> {ui.packLocked(missing)}
        </p>
      )}
      <div className="map-path" ref={pathRef}>
        {line && (
          <svg className="map-line" viewBox={`0 0 ${line.width} ${line.height}`} aria-hidden>
            <path d={line.d} />
          </svg>
        )}
        <ol>
          {placed.map((step, i) => {
            const { unit, unitState: u } = step;
            const previous = gatingUnit(pack.unitList, pack.unitList.indexOf(unit));
            const style = { '--x': `${step.x}%` } as CSSProperties;
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
                  {u.listening.started && u.listening.boss && (
                    <button
                      className={`map-node boss-node listening-boss${step.x > 50 ? ' on-left' : ''}${u.listening.boss.unlocked ? '' : ' locked'}${u.listening.boss.defeated ? ' defeated' : ''}`}
                      disabled={!u.listening.boss.unlocked}
                      onClick={() => onBoss(unit.key, true)}
                      aria-label={u.listening.boss.unlocked ? ui.listeningBossLabel(unit.title) : ui.listeningBossLocked(unit.title)}
                      title={u.listening.boss.unlocked ? ui.listeningBossLabel(unit.title) : ui.listeningBossLocked(unit.title)}
                    >
                      <Emoji char="👂" />
                    </button>
                  )}
                  {u.boss.defeated && <span className="map-caption small">{ui.bossDefeated}</span>}
                </li>
              );
            }
            const due = unit.entryIds.filter((id) => cards[cardKey(id)] && isDue(cards[cardKey(id)]!, today)).length;
            const lockedLabel = previous ? ui.unitLocked(unit.title, previous.title) : unit.title;
            const title = splitTitle(unit.title);
            return (
              <li key={unit.key} className="map-step unit-step" style={style} data-index={i}>
                <button
                  className={`map-node unit-node${u.locked ? ' locked' : ''}${u.golden ? ' golden' : ''}`}
                  disabled={u.locked}
                  onClick={() => onPractice(unit.key)}
                  aria-label={u.locked ? lockedLabel : `${unit.title}, ${ui.masteryPeakLabel(u.mastery, u.peak)}`}
                  title={u.locked ? lockedLabel : undefined}
                >
                  <Emoji char={unit.icon} />
                  {u.locked && (
                    <span className="node-lock">
                      <Icon name="lock" />
                    </span>
                  )}
                </button>
                <Crowns mastery={u.mastery} peak={u.peak} />
                <span className="map-caption">
                  <span className="map-title">
                    {title.label && <span className="map-label">{title.label}</span>}
                    {title.name}
                  </span>
                  <span className="muted small">
                    {ui.unitSeen(u.seen, u.total)}
                    {due ? ` · ${ui.unitDue(due)}` : ''}
                  </span>
                  {u.golden && <span className="mastered-badge small">{ui.mastered}</span>}
                  {u.refresh.length > 0 && (
                    <button className="refresh-link small" onClick={() => onRefresh(unit.key, u.refresh)}>
                      {ui.toRefresh(u.refresh.length)}
                    </button>
                  )}
                  {u.listening.started && (
                    <span className="listening-level small" role="img" aria-label={ui.listeningLevel(u.listening.mastery)}>
                      <Icon name="headphones" /> {u.listening.mastery}/5
                    </span>
                  )}
                  {u.listening.golden && <span className="mastered-badge small">{ui.goldenEar}</span>}
                </span>
              </li>
            );
          })}
          {more && (
            <li className="map-step more-step" style={{ '--x': `${endX}%` } as CSSProperties}>
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
