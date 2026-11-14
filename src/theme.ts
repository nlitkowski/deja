import { useEffect } from 'react';
import type { Theme } from './lib/storage';

const THEME_COLORS = { light: '#faf7f2', dark: '#11152a' } as const;
const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

/** Mirrors the inline script in index.html, which applies the saved theme before the first paint. */
export function useTheme(theme: Theme) {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;

    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const query = darkQuery();
    const sync = () => {
      const dark = theme === 'dark' || (theme === 'system' && !!query?.matches);
      meta?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light);
    };
    sync();
    query?.addEventListener('change', sync);
    return () => query?.removeEventListener('change', sync);
  }, [theme]);
}
