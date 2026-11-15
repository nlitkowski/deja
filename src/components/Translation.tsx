import { useState, type ReactNode } from 'react';
import { ui } from '../i18n/ui';

/**
 * A French sentence whose translation the learner asks for: a tap on the sentence (or on the small language
 * mark at its end) shows it, so the French is read (and understood, or not) first. Give it a `key` tied to
 * the sentence where the same spot shows different sentences in turn.
 */
export function Translation({ text, lang, children }: { text: string; lang: string; children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <button type="button" className="translatable" aria-expanded={shown} onClick={() => setShown((s) => !s)}>
        <span lang="fr">{children}</span>
        <span className="translate-mark" aria-hidden>
          {lang.toUpperCase()}
        </span>
        <span className="visually-hidden">{shown ? ui.hideTranslation : ui.translate}</span>
      </button>
      {shown && (
        <span className="translation muted" lang={lang}>
          {text}
        </span>
      )}
    </>
  );
}
