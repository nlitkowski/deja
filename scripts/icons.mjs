// Renders the PWA icons in public/ from the SVG sources. Run after changing the logo: node scripts/icons.mjs
import sharp from 'sharp';

const icons = [
  { from: 'public/favicon.svg', to: 'public/pwa-192.png', size: 192 },
  { from: 'public/favicon.svg', to: 'public/pwa-512.png', size: 512 },
  { from: 'public/icon-maskable.svg', to: 'public/pwa-maskable-512.png', size: 512 },
];

for (const { from, to, size } of icons) {
  await sharp(from, { density: (72 * size) / 512 }).resize(size, size).png().toFile(to);
  console.log(to);
}
