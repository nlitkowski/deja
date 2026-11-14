import type { MouseEvent } from 'react';
import { content } from '../content/registry';
import type { SheetSection } from '../content/sheet';
import { ui } from '../i18n/ui';
import { Emoji } from './Emoji';

export const KIND_ICON: Record<SheetSection['kind'], string> = { grammar: '📐', vocabulary: '📚', phrases: '💬' };

export const sectionId = (index: number) => `section-${index}`;

interface Props {
  currentKey?: string;
  activeSection?: number;
  onOpenSheet: (key: string) => void;
  onJump: (index: number) => void;
}

/** Packs → sheets → sections of the open sheet. Links keep real hrefs so they work with the keyboard and middle-click. */
export function ContentTree({ currentKey, activeSection, onOpenSheet, onJump }: Props) {
  const current = currentKey ? content.sheets.get(currentKey) : undefined;

  const follow = (e: MouseEvent, go: () => void) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    go();
  };

  return (
    <nav className="content-tree" aria-label={ui.treeLabel}>
      {content.packs
        .filter((p) => p.sheetList.length)
        .map((pack) => (
          <details key={pack.id} className="tree-pack" open={!current || current.packId === pack.id}>
            <summary>
              <Emoji char={pack.icon} /> {pack.title} <span className="level">{pack.level}</span>
            </summary>
            <ul>
              {pack.sheetList.map((sheet) => {
                const isCurrent = sheet.key === currentKey;
                return (
                  <li key={sheet.key}>
                    <a
                      href={`#${sheet.key}`}
                      className="tree-sheet"
                      aria-current={isCurrent ? 'page' : undefined}
                      onClick={(e) => follow(e, () => onOpenSheet(sheet.key))}
                    >
                      <span className="tree-icon">
                        <Emoji char={sheet.icon} />
                      </span>
                      <span>
                        {sheet.label && <span className="tree-label">{sheet.label}</span>}
                        <span className="tree-title">{sheet.title}</span>
                      </span>
                    </a>
                    {isCurrent && (
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
