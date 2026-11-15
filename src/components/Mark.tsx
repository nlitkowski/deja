import { MARK_PIXEL, MARK_SMOOTH } from '../mark';

/** The "à" eye mark. Both variants are rendered and CSS shows the pixel one in 8-bit, so palette previews match. */
export function Mark({ className = '' }: { className?: string }) {
  return (
    <span className={`mark ${className}`} aria-hidden>
      <svg className="mark-smooth" viewBox={MARK_SMOOTH.viewBox} dangerouslySetInnerHTML={{ __html: MARK_SMOOTH.body + MARK_SMOOTH.pupil }} />
      <svg
        className="mark-pixel"
        viewBox={MARK_PIXEL.viewBox}
        shapeRendering="crispEdges"
        dangerouslySetInnerHTML={{ __html: MARK_PIXEL.body + MARK_PIXEL.pupil }}
      />
    </span>
  );
}
