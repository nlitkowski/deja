import confetti from 'canvas-confetti';

/** Resolves a colour token (which may use light-dark()) to the colour currently on screen. */
function tokenColor(name: string): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  const [r = 0, g = 0, b = 0] = color.match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

/** Confetti in the active palette's colours; square and flat in 8-bit. Skipped for reduced motion. */
export function celebrate() {
  const pixel = document.documentElement.dataset.palette === 'pixel';
  const colors = ['--highlight', '--accent', '--success', '--danger'].map(tokenColor);
  const shared = { colors, disableForReducedMotion: true, particleCount: 90, spread: 70, ticks: 220 };
  const shape = pixel ? { shapes: ['square' as const], flat: true, scalar: 1.4 } : {};
  void confetti({ ...shared, ...shape, origin: { x: 0.2, y: 0.7 }, angle: 60 });
  void confetti({ ...shared, ...shape, origin: { x: 0.8, y: 0.7 }, angle: 120 });
}
