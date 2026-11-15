import { useEffect } from 'react';
import type { ColorMode, Palette } from './lib/storage';
import { faviconSvg } from './mark';

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

/** Resolves a colour token (light-dark() included) to rgb() by letting the browser compute it. */
function resolveColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  probe.style.display = 'none';
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function syncFavicon(palette: Palette) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
  if (!link) return;
  const svg = faviconSvg(palette === 'pixel', {
    tile: resolveColor('--favicon-tile'),
    mark: resolveColor('--favicon-mark'),
    pupil: resolveColor('--favicon-pupil'),
  });
  link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Mirrors the inline script in index.html, which applies the saved theme before the first paint. */
export function useTheme(colorMode: ColorMode, palette: Palette) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.palette = palette;
    if (colorMode === 'system') delete root.dataset.theme;
    else root.dataset.theme = colorMode;

    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const sync = () => {
      meta?.setAttribute('content', getComputedStyle(document.body).backgroundColor);
      syncFavicon(palette);
    };
    sync();
    const query = darkQuery();
    query?.addEventListener('change', sync);
    return () => query?.removeEventListener('change', sync);
  }, [colorMode, palette]);
}
