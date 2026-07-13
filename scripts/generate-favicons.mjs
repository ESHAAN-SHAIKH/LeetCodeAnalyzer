// Generate a comprehensive favicon package from favicon.svg using sharp.
// Outputs: favicon.ico (16+32+48), favicon-32x32.png, favicon-16x16.png,
//          apple-touch-icon.png (180), android-chrome 192/512,
//          site.webmanifest.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '..', 'public');
const svgPath = path.join(publicDir, 'favicon.svg');

const svg = await readFile(svgPath);

// Rasterize all required sizes
const sizes = [16, 32, 48, 64, 96, 128, 180, 192, 256, 384, 512];
for (const s of sizes) {
  const file = path.join(publicDir, `favicon-${s}x${s}.png`);
  await sharp(svg, { density: 384 })
    .resize(s, s, { fit: 'contain', background: { r: 11, g: 14, b: 12, alpha: 1 } })
    .png()
    .toFile(file);
  console.log('wrote', path.basename(file));
}

// Multi-size ICO: 16 + 32 + 48
const ico16 = await sharp(svg).resize(16, 16).png().toBuffer();
const ico32 = await sharp(svg).resize(32, 32).png().toBuffer();
const ico48 = await sharp(svg).resize(48, 48).png().toBuffer();
//
// Build a simple ICO container manually. ICO with PNG payloads is widely
// supported (Vista+). Each entry: width(1), height(1), 0, 0, 1, 32,
// reserved(2) -> wait actually the ICONDIR entry layout:
//   width(1) height(1) reserved(1)=0 planes(2)=1 bitCount(2)=32
//   bytesInRes(4) offset(4)
// Here 32-bit PNG-in-ICO is the standard modern format.

function buildIco(entries) {
  const ICONDIR_SIZE = 6;
  const ICONDIR_ENTRY_SIZE = 16;
  const headerSize = ICONDIR_SIZE + entries.length * ICONDIR_ENTRY_SIZE;
  const dir = Buffer.alloc(headerSize);
  dir.writeUInt16LE(0, 0);     // Reserved
  dir.writeUInt16LE(1, 2);     // Type 1 = ICO
  dir.writeUInt16LE(entries.length, 4);
  let offset = headerSize;
  const blobs = [];
  for (let idx = 0; idx < entries.length; idx++) {
    const { size, png } = entries[idx];
    const e = Buffer.alloc(ICONDIR_ENTRY_SIZE);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);                      // colors in palette
    e.writeUInt8(0, 3);                      // reserved
    e.writeUInt16LE(1, 4);                   // planes
    e.writeUInt16LE(32, 6);                  // bit count
    e.writeUInt32LE(png.length, 8);          // bytes in resource
    e.writeUInt32LE(offset, 12);             // offset
    dir.set(e, ICONDIR_SIZE + idx * ICONDIR_ENTRY_SIZE);
    offset += png.length;
    blobs.push(png);
  }
  return Buffer.concat([dir, ...blobs]);
}

const ico = buildIco([
  { size: 16, png: ico16 },
  { size: 32, png: ico32 },
  { size: 48, png: ico48 },
]);
await import('node:fs/promises').then(fs => fs.writeFile(path.join(publicDir, 'favicon.ico'), ico));
console.log('wrote favicon.ico');

// site.webmanifest
const manifest = {
  name: 'LeetCodeAnalyzer',
  short_name: 'LeetCodeAnalyzer',
  description: 'Free LeetCode progress tracker — Blind 75, NeetCode 150, Grind 75 coverage and complexity analyzer.',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#0B0E0C',
  theme_color: '#0B0E0C',
  icons: [
    { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
  ],
};
await import('node:fs/promises').then(fs => fs.writeFile(
  path.join(publicDir, 'site.webmanifest'),
  JSON.stringify(manifest, null, 2)
));
console.log('wrote site.webmanifest');

// Apple-touch-icon alias plus Chrome Android-chrome aliases
await import('node:fs/promises').then(async fs => {
  await fs.copyFile(
    path.join(publicDir, 'favicon-180x180.png'),
    path.join(publicDir, 'apple-touch-icon.png')
  );
  await fs.copyFile(
    path.join(publicDir, 'favicon-192x192.png'),
    path.join(publicDir, 'android-chrome-192x192.png')
  );
  await fs.copyFile(
    path.join(publicDir, 'favicon-512x512.png'),
    path.join(publicDir, 'android-chrome-512x512.png')
  );
});
console.log('wrote apple-touch / android-chrome aliases');
