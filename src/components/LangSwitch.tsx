import { useId } from 'react';
import { HELP_LANGS, type HelpLang } from '../content/localized';
import { ui } from '../i18n/ui';

export function LangSwitch({ value, onChange }: { value: HelpLang; onChange: (lang: HelpLang) => void }) {
  const labelId = useId();
  return (
    <div className="lang-switch">
      <span className="lang-switch-label" id={labelId}>
        {ui.helpLangLabel}
      </span>
      <div className="pill" role="radiogroup" aria-labelledby={labelId}>
        {HELP_LANGS.map((lang) => (
          <button
            key={lang}
            role="radio"
            aria-checked={value === lang}
            aria-label={ui.helpLangNames[lang]}
            title={ui.helpLangNames[lang]}
            onClick={() => onChange(lang)}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
