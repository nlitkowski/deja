// Geometry of the "à" eye mark (public/mark.svg, public/mark-pixel.svg); the pupil stays a separate `.pupil` element for a future animation.
const PIXEL_BODY = [
  [3, 2], [4, 2], [5, 3], [6, 3], [4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [4, 11], [5, 11], [6, 11], [7, 11], [8, 11],
  [3, 6], [3, 7], [3, 8], [3, 9], [3, 10], [9, 4], [9, 5], [9, 6], [9, 7], [9, 8], [9, 9], [9, 10], [9, 11], [10, 11],
];
const PIXEL_PUPIL = [[5, 7], [6, 7], [5, 8], [6, 8]];

const pixels = (cells: number[][]) => cells.map(([x, y]) => `M${x} ${y}h1v1h-1z`).join('');

export const MARK_SMOOTH = {
  viewBox: '15 5 71 83',
  body:
    '<circle cx="44" cy="58" r="19" fill="none" stroke="currentColor" stroke-width="9"/>' +
    '<path d="M67 37 V70 Q67 79 77 79" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>' +
    '<line x1="24" y1="14" x2="52" y2="26" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>',
  pupil: '<circle class="pupil" cx="37" cy="54" r="7" fill="var(--mark-pupil, currentColor)"/>',
};

export const MARK_PIXEL = {
  viewBox: '0 0 14 14',
  body: `<path d="${pixels(PIXEL_BODY)}" fill="currentColor"/>`,
  pupil: `<path class="pupil" d="${pixels(PIXEL_PUPIL)}" fill="var(--mark-pupil, currentColor)"/>`,
};

/** Favicon in the given colours: the smooth mark on a rounded tile (public/favicon.svg), or the pixel one on a square tile. */
export function faviconSvg(pixel: boolean, colors: { tile: string; mark: string; pupil: string }): string {
  const { tile, mark, pupil } = colors;
  if (pixel) {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" shape-rendering="crispEdges">` +
      `<rect width="14" height="14" fill="${tile}"/>` +
      `<path d="${pixels(PIXEL_BODY)}" fill="${mark}"/><path class="pupil" d="${pixels(PIXEL_PUPIL)}" fill="${pupil}"/></svg>`
    );
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">` +
    `<rect width="96" height="96" rx="22" fill="${tile}"/>` +
    `<g transform="translate(-2.5 1.5)" color="${mark}">${MARK_SMOOTH.body}` +
    `<circle class="pupil" cx="37" cy="54" r="7" fill="${pupil}"/></g></svg>`
  );
}
