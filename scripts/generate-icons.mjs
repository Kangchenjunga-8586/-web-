// Renders the app icon SVG to the PNG sizes iOS / the PWA manifest need, using the
// Playwright Chromium that is already available in CI and the cloud dev environment.
// Usage: npm run icons
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'public');

/** Full-bleed icon (iOS applies its own rounded mask). `inset` shrinks the glyph for maskable safe zones. */
function iconSvg(size, inset = 0) {
  const s = size;
  const c = s / 2;
  const scale = 1 - inset;
  const r = s * 0.3 * scale;
  const stroke = s * 0.085 * scale;
  const circumference = 2 * Math.PI * r;
  const progress = 0.72;
  const fontSize = s * 0.3 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3a8cf0"/>
      <stop offset="1" stop-color="#1c5cab"/>
    </linearGradient>
  </defs>
  <rect width="${s}" height="${s}" fill="url(#bg)"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="${stroke}"/>
  <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#ffffff" stroke-width="${stroke}" stroke-linecap="round"
    stroke-dasharray="${circumference * progress} ${circumference}" transform="rotate(-90 ${c} ${c})"/>
  <text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central" fill="#ffffff"
    font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${fontSize}">¥</text>
</svg>`;
}

const targets = [
  { file: 'apple-touch-icon.png', size: 180, inset: 0 },
  { file: 'pwa-192.png', size: 192, inset: 0 },
  { file: 'pwa-512.png', size: 512, inset: 0 },
  { file: 'pwa-maskable-512.png', size: 512, inset: 0.2 },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0">${iconSvg(t.size, t.inset)}</body></html>`);
  await page.screenshot({ path: path.join(out, t.file), omitBackground: false });
  console.log(`wrote public/${t.file}`);
}
await browser.close();
await writeFile(path.join(out, 'favicon.svg'), iconSvg(64));
console.log('wrote public/favicon.svg');
