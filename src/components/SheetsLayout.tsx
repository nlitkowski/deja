import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { HelpLang } from '../content/localized';
import { AppLayout, MenuButton } from './AppLayout';
import { Icon } from './Icon';
import { LangSwitch } from './LangSwitch';
import { sectionId } from './NavTree';

interface Props {
  currentKey?: string;
  /** Section headings of the open sheet, for the sticky bar on small screens. */
  sectionTitles?: string[];
  backLabel: string;
  helpLang: HelpLang;
  onHelpLang: (lang: HelpLang) => void;
  onOpenSheet: (key: string) => void;
  onPractice: (unitKey: string) => void;
  onBack: () => void;
  children: ReactNode;
}

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Index of the section currently at the top of the viewport. */
function useActiveSection(count: number, resetKey?: string) {
  // Keyed by sheet, so opening another sheet starts at its first section without an extra render.
  const [state, setState] = useState({ key: resetKey, index: 0 });
  const active = state.key === resetKey ? state.index : 0;
  const setActive = useCallback((index: number) => setState({ key: resetKey, index }), [resetKey]);

  useEffect(() => {
    if (!count || !('IntersectionObserver' in window)) return;
    const visible = new Set<number>();
    const observer = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          const index = Number((r.target as HTMLElement).dataset.index);
          if (r.isIntersecting) visible.add(index);
          else visible.delete(index);
        }
        if (visible.size) setActive(Math.min(...visible));
      },
      // A thin band near the top: the section crossing it is the one being read.
      { rootMargin: '-20% 0px -70% 0px' },
    );
    for (let i = 0; i < count; i++) {
      const el = document.getElementById(sectionId(i));
      if (el) {
        el.dataset.index = String(i);
        observer.observe(el);
      }
    }
    return () => observer.disconnect();
  }, [count, setActive]);
  return [active, setActive] as const;
}

/** Sheet screens: the shared navigation layout plus a sticky bar showing the section being read. */
export function SheetsLayout({ currentKey, sectionTitles = [], backLabel, helpLang, onHelpLang, onOpenSheet, onPractice, onBack, children }: Props) {
  const [active, setActive] = useActiveSection(sectionTitles.length, currentKey);

  const jump = (index: number) => {
    setActive(index);
    const section = document.getElementById(sectionId(index));
    section?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    section?.focus({ preventScroll: true });
  };

  return (
    <AppLayout currentSheetKey={currentKey} activeSection={active} onJump={jump} onOpenSheet={onOpenSheet} onPractice={onPractice}>
      <header className="sheets-bar">
        <MenuButton />
        <button className="back-button" onClick={onBack} aria-label={backLabel}>
          <Icon name="back" /> <span className="back-text">{backLabel}</span>
        </button>
        {sectionTitles.length > 0 && <span className="bar-section">{sectionTitles[active]}</span>}
        <LangSwitch value={helpLang} onChange={onHelpLang} />
      </header>
      {children}
    </AppLayout>
  );
}
