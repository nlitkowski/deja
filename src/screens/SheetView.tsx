import { useEffect } from 'react';
import { KIND_ICON, sectionId } from '../components/NavTree';
import { AudioDownload } from '../components/AudioDownload';
import { Play } from '../components/Play';
import { isSentence } from '../audio/texts';
import { RichText } from '../components/RichText';
import { SheetsLayout } from '../components/SheetsLayout';
import { Translation } from '../components/Translation';
import { localize, type HelpLang } from '../content/localized';
import { content } from '../content/registry';
import type { SheetBlock } from '../content/sheet';
import { ui } from '../i18n/ui';
import { Emoji } from '../components/Emoji';

interface Props {
  sheetKey: string;
  helpLang: HelpLang;
  onHelpLang: (lang: HelpLang) => void;
  onPractice: (unitKey: string) => void;
  onOpenSheet: (key: string) => void;
  onBack: () => void;
}

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
                        {!block.audio?.skip && isSentence(cell) && <Play text={cell} />}
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
                <Play text={item.fr} audio={item.audio} />
                {lang === 'pl' ? (
                  <Translation key={item.fr} text={item.pl} lang="pl">
                    <RichText text={item.fr} />
                  </Translation>
                ) : (
                  <span lang="fr">
                    <RichText text={item.fr} />
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
                    <Play text={item.fr} audio={item.audio} />
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

export function SheetView({ sheetKey, helpLang, onHelpLang, onPractice, onOpenSheet, onBack }: Props) {
  const sheet = content.sheets.get(sheetKey);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [sheetKey]);

  if (!sheet) return null;
  const practice = sheet.practice.map((key) => content.units.get(key)).filter((u) => u !== undefined);

  return (
    <SheetsLayout
      currentKey={sheet.key}
      sectionTitles={sheet.sections.map((section) => section.title)}
      backLabel={ui.sheets}
      helpLang={helpLang}
      onHelpLang={onHelpLang}
      onOpenSheet={onOpenSheet}
      onPractice={onPractice}
      onBack={onBack}
    >
      <div className="sheet-hero">
        {sheet.label && <p className="kicker">{sheet.label}</p>}
        <h1>
          <Emoji char={sheet.icon} /> {sheet.title}
        </h1>
        {sheet.summary && (
          <p className="muted" lang={helpLang}>
            {localize(sheet.summary, helpLang)}
          </p>
        )}
        <AudioDownload key={sheet.key} sheets={[sheet.key]} units={sheet.practice} />
      </div>

      {sheet.sections.map((section, i) => (
        <section key={i} id={sectionId(i)} tabIndex={-1} className={`sheet-section kind-${section.kind}`}>
          <p className="section-kind">
            <Emoji char={KIND_ICON[section.kind]} /> {ui.sectionKinds[section.kind]}
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
              <Emoji char={unit.icon} /> {unit.title}
            </button>
          ))}
        </section>
      )}
    </SheetsLayout>
  );
}
