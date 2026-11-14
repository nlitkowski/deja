import type { MouseEvent } from 'react';
import { content } from '../content/registry';
import type { Pack, Unit } from '../content/schema';
import type { Sheet, SheetSection } from '../content/sheet';
import { ui } from '../i18n/ui';
import { useLockedUnits } from '../state/useGame';
import { Emoji } from './Emoji';
import { Icon } from './Icon';

export const KIND_ICON: Record<SheetSection['kind'], string> = { grammar: '📐', vocabulary: '📚', phrases: '💬' };

export const sectionId = (index: number) => `section-${index}`;

/** One row of the tree: a sheet, an exercise unit, or both when they share an id (Édito unités). */
interface Lesson {
  key: string;
  sheet?: Sheet;
  unit?: Unit;
}

function lessonsOf(pack: Pack): Lesson[] {
  const sheets = new Map(pack.sheetList.map((s) => [s.id, s]));
  const lessons: Lesson[] = pack.unitList.map((unit) => {
    const sheet = sheets.get(unit.id);
    sheets.delete(unit.id);
    return { key: unit.key, unit, sheet };
  });
  for (const sheet of sheets.values()) lessons.push({ key: sheet.key, sheet });
  return lessons;
}

export interface NavTreeProps {
  currentSheetKey?: string;
  activeSection?: number;
  onOpenSheet: (key: string) => void;
  onPractice: (unitKey: string) => void;
  onJump?: (index: number) => void;
}

/** Packs → lessons → sections of the open sheet. Shared by the home screen and the sheet screens. */
export function NavTree({ currentSheetKey, activeSection, onOpenSheet, onPractice, onJump }: NavTreeProps) {
  const current = currentSheetKey ? content.sheets.get(currentSheetKey) : undefined;
  const locked = useLockedUnits();

  const follow = (e: MouseEvent, go: () => void) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    go();
  };

  return (
    <nav className="content-tree" aria-label={ui.treeLabel}>
      {content.packs.map((pack) => (
        <details key={pack.id} className="tree-pack" open={!current || current.packId === pack.id}>
          <summary>
            <Emoji char={pack.icon} /> {pack.title} <span className="level">{pack.level}</span>
          </summary>
          <ul>
            {lessonsOf(pack).map(({ key, sheet, unit }) => {
              const isCurrent = !!sheet && sheet.key === currentSheetKey;
              const label = sheet?.label;
              const title = sheet?.title ?? unit!.title;
              const body = (
                <>
                  <span className="tree-icon">
                    <Emoji char={sheet?.icon ?? unit!.icon} />
                  </span>
                  <span>
                    {label && <span className="tree-label">{label}</span>}
                    <span className="tree-title">{title}</span>
                  </span>
                </>
              );
              return (
                <li key={key}>
                  <div className="tree-row">
                    {sheet ? (
                      <a
                        href={`#${sheet.key}`}
                        className="tree-sheet"
                        aria-current={isCurrent ? 'page' : undefined}
                        onClick={(e) => follow(e, () => onOpenSheet(sheet.key))}
                      >
                        {body}
                      </a>
                    ) : (
                      <button className="tree-sheet" disabled={locked.has(unit!.key)} onClick={() => onPractice(unit!.key)}>
                        {body}
                      </button>
                    )}
                    {sheet && unit && (
                      <button
                        className="tree-action"
                        disabled={locked.has(unit.key)}
                        onClick={() => onPractice(unit.key)}
                        aria-label={locked.has(unit.key) ? `${ui.locked} : ${title}` : ui.practiceUnit(title)}
                        title={locked.has(unit.key) ? ui.locked : ui.practiceThis}
                      >
                        <Icon name={locked.has(unit.key) ? 'lock' : 'play'} />
                      </button>
                    )}
                  </div>
                  {isCurrent && onJump && (
                    <ol className="tree-sections">
                      {sheet.sections.map((section, i) => (
                        <li key={i}>
                          <a
                            href={`#${sectionId(i)}`}
                            className="tree-section"
                            aria-current={i === activeSection ? 'location' : undefined}
                            onClick={(e) => follow(e, () => onJump(i))}
                          >
                            <Emoji char={KIND_ICON[section.kind]} /> {section.title}
                          </a>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </nav>
  );
}
