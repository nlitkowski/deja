import { useEffect, useRef } from 'react';

/** Canvas resolution of the pixel version: small enough to look 8-bit once scaled up. */
const PIXEL_SIZE = 14;
const EMOJI_FONT = `${PIXEL_SIZE - 2}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;

/**
 * A content emoji. In the 8-bit palette CSS swaps the glyph for a low-resolution canvas drawing
 * of the same emoji, scaled up without smoothing, so any emoji in a content pack becomes pixel art.
 */
/**
 * What the canvas draws: a ZWJ sequence (👨‍👩‍👧) or a variation selector can come out as an empty box on a
 * 14-pixel canvas (iOS), so the drawing keeps only the first emoji of a sequence. Content icons are single
 * characters anyway (content.test.ts); this covers packs imported from a file.
 */
export const pixelChar = (char: string) => char.split('\u200d')[0]!.replace(/\ufe0f/g, '');

export function Emoji({ char }: { char: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, PIXEL_SIZE, PIXEL_SIZE);
    ctx.font = EMOJI_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pixelChar(char), PIXEL_SIZE / 2, PIXEL_SIZE / 2 + 1);
  }, [char]);

  return (
    <span className="emoji" aria-hidden>
      <span className="emoji-glyph">{char}</span>
      <canvas ref={canvas} className="emoji-pixel" width={PIXEL_SIZE} height={PIXEL_SIZE} />
    </span>
  );
}
