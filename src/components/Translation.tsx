import { useState } from 'react';
import { ui } from '../i18n/ui';

/**
 * A translation the learner asks for: hidden behind « Traduire » so the French is read (and understood, or
 * not) first. Give it a `key` tied to the sentence where the same spot shows different sentences in turn.
 */
export function Translation({ text, lang }: { text: string; lang: string }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <button className="translate-button" aria-expanded={shown} onClick={() => setShown((s) => !s)}>
        {shown ? ui.hideTranslation : ui.translate}
      </button>
      {shown && (
        <span className="translation muted" lang={lang}>
          {text}
        </span>
      )}
    </>
  );
}
