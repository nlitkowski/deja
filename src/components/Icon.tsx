/**
 * Interface icons. Every palette shows the text glyph except 8-bit, which shows a pixel drawing;
 * both are rendered and CSS picks one, so palette previews show the right variant too.
 */
const PIXELS = {
  menu: ['........', 'XXXXXXXX', '........', 'XXXXXXXX', '........', 'XXXXXXXX', '........', '........'],
  close: ['XX....XX', 'XXX..XXX', '.XXXXXX.', '..XXXX..', '..XXXX..', '.XXXXXX.', 'XXX..XXX', 'XX....XX'],
  back: ['....XX..', '...XX...', '..XX....', '.XX.....', '.XX.....', '..XX....', '...XX...', '....XX..'],
  next: ['..XX....', '...XX...', '....XX..', '.....XX.', '.....XX.', '....XX..', '...XX...', '..XX....'],
  settings: ['X..XX..X', '.XXXXXX.', '.XX..XX.', 'XX....XX', 'XX....XX', '.XX..XX.', '.XXXXXX.', 'X..XX..X'],
  hint: ['..XXXX..', '.X....X.', 'X......X', 'X......X', '.X....X.', '..XXXX..', '..XXXX..', '...XX...'],
  play: ['.X......', '.XX.....', '.XXX....', '.XXXX...', '.XXXX...', '.XXX....', '.XX.....', '.X......'],
  collapse: ['...X...X', '..X...X.', '.X...X..', 'X...X...', 'X...X...', '.X...X..', '..X...X.', '...X...X'],
  crown: ['........', 'X..XX..X', 'XX.XX.XX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '.XXXXXX.', '........'],
  trophy: ['XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...', '...XX...', '..XXXX..', '.XXXXXX.'],
  lock: ['..XXXX..', '.X....X.', '.X....X.', 'XXXXXXXX', 'XXX..XXX', 'XXX..XXX', 'XXXXXXXX', '........'],
} as const;

// U+FE0E keeps ▶ as a text glyph; without it some platforms draw an emoji.
const GLYPHS: Record<IconName, string> = { menu: '☰', close: '✕', back: '‹', next: '›', settings: '⚙', hint: '💡', play: '▶︎', collapse: '«', crown: '♛', lock: '🔒', trophy: '🏆' };

export type IconName = keyof typeof PIXELS;

const PATHS = Object.fromEntries(
  Object.entries(PIXELS).map(([name, rows]) => [
    name,
    rows.flatMap((row, y) => [...row].map((c, x) => (c === 'X' ? `M${x} ${y}h1v1h-1z` : ''))).join(''),
  ]),
) as Record<IconName, string>;

export function Icon({ name }: { name: IconName }) {
  return (
    <span className="icon" aria-hidden>
      <span className="icon-glyph">{GLYPHS[name]}</span>
      <svg className="icon-pixel" viewBox="0 0 8 8" shapeRendering="crispEdges">
        <path d={PATHS[name]} fill="currentColor" />
      </svg>
    </span>
  );
}
