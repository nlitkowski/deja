import { SheetsLayout } from '../components/SheetsLayout';
import type { HelpLang } from '../content/localized';
import { localize } from '../content/localized';
import { content } from '../content/registry';
import { ui } from '../i18n/ui';
import { Icon } from '../components/Icon';
import { Emoji } from '../components/Emoji';

interface Props {
  helpLang: HelpLang;
  onHelpLang: (lang: HelpLang) => void;
  onOpen: (sheetKey: string) => void;
  onBack: () => void;
}

export function SheetList({ helpLang, onHelpLang, onOpen, onBack }: Props) {
  return (
    <SheetsLayout backLabel={ui.back} helpLang={helpLang} onHelpLang={onHelpLang} onOpenSheet={onOpen} onBack={onBack}>
      <h1>{ui.sheets}</h1>

      {content.packs
        .filter((p) => p.sheetList.length)
        .map((pack) => (
          <section key={pack.id} className="pack">
            <h2>
              <Emoji char={pack.icon} /> {pack.title} <span className="level">{pack.level}</span>
            </h2>
            <ol className="unit-list">
              {pack.sheetList.map((sheet) => (
                <li key={sheet.key}>
                  <button className="unit" onClick={() => onOpen(sheet.key)}>
                    <span className="unit-icon">
                      <Emoji char={sheet.icon} />
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
                      <Icon name="next" />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ))}
    </SheetsLayout>
  );
}
