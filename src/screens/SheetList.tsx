import { LangSwitch } from '../components/LangSwitch';
import type { HelpLang } from '../content/localized';
import { localize } from '../content/localized';
import { content } from '../content/registry';
import { ui } from '../i18n/ui';

interface Props {
  helpLang: HelpLang;
  onHelpLang: (lang: HelpLang) => void;
  onOpen: (sheetKey: string) => void;
  onBack: () => void;
}

export function SheetList({ helpLang, onHelpLang, onOpen, onBack }: Props) {
  return (
    <main className="screen sheet-list">
      <header className="top-bar">
        <button className="back-button" onClick={onBack}>
          ‹ {ui.back}
        </button>
        <LangSwitch value={helpLang} onChange={onHelpLang} />
      </header>
      <h1>{ui.sheets}</h1>

      {content.packs
        .filter((p) => p.sheetList.length)
        .map((pack) => (
          <section key={pack.id} className="pack">
            <h2>
              <span aria-hidden>{pack.icon}</span> {pack.title} <span className="level">{pack.level}</span>
            </h2>
            <ol className="unit-list">
              {pack.sheetList.map((sheet) => (
                <li key={sheet.key}>
                  <button className="unit" onClick={() => onOpen(sheet.key)}>
                    <span className="unit-icon" aria-hidden>
                      {sheet.icon}
                    </span>
                    <span className="unit-body">
                      {sheet.label && <span className="kicker">{sheet.label}</span>}
                      <span className="unit-title">{sheet.title}</span>
                      {sheet.summary && (
                        <span className="muted small" lang={helpLang}>
                          {localize(sheet.summary, helpLang)}
                        </span>
                      )}
                    </span>
                    <span className="chevron" aria-hidden>
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
    </main>
  );
}
