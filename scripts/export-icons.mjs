#!/usr/bin/env node
// SVG → PNG icon generator using @resvg/resvg-js
// Usage: node scripts/export-icons.mjs
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const svg = readFileSync(join(ROOT, 'public/icons/icon.svg'), 'utf8');

const SIZES = [16, 32, 48, 128, 256];
const NAME_MAP = {
  16: 'icon-16',
  32: 'icon-32',
  48: 'icon-48',
  128: 'icon-128',
  256: 'icon-256',
};

for (const size of SIZES) {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  const outPath = join(ROOT, `public/icons/${NAME_MAP[size]}.png`);
  writeFileSync(outPath, pngBuffer);
  console.log(`Generated ${NAME_MAP[size]}.png (${pngBuffer.length} bytes)`);
}
console.log('All icons exported.');
