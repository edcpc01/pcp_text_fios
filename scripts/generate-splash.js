/**
 * scripts/generate-splash.js
 *
 * Gera splash screens para iOS (apple-touch-startup-image).
 * Execute após instalar sharp: npm install sharp
 *
 * Uso: node scripts/generate-splash.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICON_PATH = path.join(__dirname, '../public/icons/icon-512.png');
const OUT_DIR = path.join(__dirname, '../public/icons');
fs.mkdirSync(OUT_DIR, { recursive: true });

const BG_COLOR = { r: 12, g: 18, b: 34, alpha: 1 }; // #0c1222

const SIZES = [
  { name: 'splash-1290x2796.png', width: 1290, height: 2796 }, // iPhone 14 Pro Max
  { name: 'splash-1179x2556.png', width: 1179, height: 2556 }, // iPhone 14 Pro
  { name: 'splash-1170x2532.png', width: 1170, height: 2532 }, // iPhone 12/13
  { name: 'splash-750x1334.png',  width: 750,  height: 1334 }, // iPhone SE
  { name: 'splash-2048x2732.png', width: 2048, height: 2732 }, // iPad Pro 12.9"
  { name: 'splash-1668x2388.png', width: 1668, height: 2388 }, // iPad Pro 11"
  { name: 'splash-1536x2048.png', width: 1536, height: 2048 }, // iPad 10.2"
];

async function generateSplash({ name, width, height }) {
  const iconSize = Math.round(Math.min(width, height) * 0.22);
  const x = Math.round((width - iconSize) / 2);
  const y = Math.round((height - iconSize) / 2);

  // Resize icon
  const iconBuffer = await sharp(ICON_PATH).resize(iconSize, iconSize).png().toBuffer();

  // Create background + composite icon
  await sharp({
    create: { width, height, channels: 4, background: BG_COLOR },
  })
    .composite([{ input: iconBuffer, left: x, top: y }])
    .png()
    .toFile(path.join(OUT_DIR, name));

  console.log(`✅ ${name} (${width}x${height})`);
}

async function main() {
  console.log('🎨 Gerando splash screens iOS...\n');
  for (const size of SIZES) {
    await generateSplash(size);
  }
  console.log('\n✅ Splash screens geradas em public/icons/');
}

main().catch(console.error);
