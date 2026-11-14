import { useEffect } from 'react';
import { LangSwitch } from '../components/LangSwitch';
import { RichText } from '../components/RichText';
import { localize, type HelpLang } from '../content/localized';
import { content } from '../content/registry';
import type { SheetBlock } from '../content/sheet';
import { ui } from '../i18n/ui';

interface Props {
  sheetKey: string;
  helpLang: HelpLang;
  onHelpLang: (lang: HelpLang) => void;
  onPractice: (unitKey: string) => void;
  onBack: () => void;
}

const KIND_ICON = { grammar: '📐', vocabulary: '📚', phrases: '💬' } as const;

function Block({ block, lang }: { block: SheetBlock; lang: HelpLang }) {
  const title = 'title' in block ? localize(block.title, lang) : undefined;
  const heading = title && (
    <h4 className="block-title" lang={lang}>
      {title}
    </h4>
  );

  switch (block.type) {
    case 'text':
    case 'rule':
    case 'warning':
      return (
        <div className={`block-${block.type}`} lang={lang}>
          {block.type === 'warning' && <span className="block-badge">{ui.watchOut}</span>}
          <p>
            <RichText text={localize(block.text, lang)!} />
          </p>
        </div>
      );
    case 'table':
      return (
        <div className="block-table">
          {heading}
          <div className="table-scroll">
            <table lang="fr">
              <thead>
                <tr>
                  {block.head.map((h, i) => (
                    <th key={i}>
                      <RichText text={h} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>
                        <RichText text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    case 'examples':
      return (
        <div className="block-examples">
          {heading}
          <ul>
            {block.items.map((item, i) => (
              <li key={i}>
                <span lang="fr">
                  <RichText text={item.fr} />
                </span>
                {lang === 'pl' && (
                  <span className="muted" lang="pl">
                    {item.pl}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      );
    case 'words':
      return (
        <div className="block-words">
          {heading}
          <dl>
            {block.items.map((item, i) => {
              const gloss = lang === 'pl' ? item.pl : item.def;
              return (
                <div key={i} className={gloss ? '' : 'no-gloss'}>
                  <dt lang="fr">
                    <RichText text={item.fr} />
                  </dt>
                  {gloss && <dd lang={lang}>{gloss}</dd>}
                </div>
              );
            })}
          </dl>
        </div>
      );
  }
}

export function SheetView({ sheetKey, helpLang, onHelpLang, onPractice, onBack }: Props) {
  const sheet = content.sheets.get(sheetKey);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [sheetKey]);

  if (!sheet) return null;
  const practice = sheet.practice.map((key) => content.units.get(key)).filter((u) => u !== undefined);

  return (
    <main className="screen sheet">
      <header className="top-bar">
        <button className="back-button" onClick={onBack}>
          ‹ {ui.sheets}
        </button>
        <LangSwitch value={helpLang} onChange={onHelpLang} />
      </header>

      <div className="sheet-hero">
        {sheet.label && <p className="kicker">{sheet.label}</p>}
        <h1>
          <span aria-hidden>{sheet.icon}</span> {sheet.title}
        </h1>
        {sheet.summary && (
          <p className="muted" lang={helpLang}>
            {localize(sheet.summary, helpLang)}
          </p>
        )}
      </div>

      <nav className="section-chips" aria-label={ui.sheetContents}>
        {sheet.sections.map((section, i) => (
          <a key={i} href={`#section-${i}`} className={`chip chip-${section.kind}`}>
            <span aria-hidden>{KIND_ICON[section.kind]}</span> {section.title}
          </a>
        ))}
      </nav>

      {sheet.sections.map((section, i) => (
        <section key={i} id={`section-${i}`} className={`sheet-section kind-${section.kind}`}>
          <p className="section-kind">
            {KIND_ICON[section.kind]} {ui.sectionKinds[section.kind]}
          </p>
          <h2 lang="fr">{section.title}</h2>
          {section.blocks.map((block, j) => (
            <Block key={j} block={block} lang={helpLang} />
          ))}
        </section>
      ))}

      {practice.length > 0 && (
        <section className="practice">
          <h2>{ui.practiceThis}</h2>
          {practice.map((unit) => (
            <button key={unit.key} className="button primary" onClick={() => onPractice(unit.key)}>
              {unit.icon} {unit.title}
            </button>
          ))}
        </section>
      )}
    </main>
  );
}
