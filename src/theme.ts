import { useEffect } from 'react';
import type { ColorMode, Palette } from './lib/storage';

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

/** Mirrors the inline script in index.html, which applies the saved theme before the first paint. */
export function useTheme(colorMode: ColorMode, palette: Palette) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.palette = palette;
    if (colorMode === 'system') delete root.dataset.theme;
    else root.dataset.theme = colorMode;

    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const sync = () => meta?.setAttribute('content', getComputedStyle(document.body).backgroundColor);
    sync();
    const query = darkQuery();
    query?.addEventListener('change', sync);
    return () => query?.removeEventListener('change', sync);
  }, [colorMode, palette]);
}
