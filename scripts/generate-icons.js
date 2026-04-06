/**
 * Gera os ícones PNG do PWA a partir do icon-source.svg.
 * Roda automaticamente no build da Vercel: "build": "node scripts/generate-icons.js && vite build"
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const ROOT    = path.join(__dirname, '..');
const SVG_SRC = path.join(ROOT, 'public', 'icon-source.svg');

const ICONS = [
  { file: path.join(ROOT, 'public', 'icons', 'icon-192.png'),          size: 192 },
  { file: path.join(ROOT, 'public', 'icons', 'icon-512.png'),          size: 512 },
  { file: path.join(ROOT, 'public', 'icons', 'icon-maskable-512.png'), size: 512 },
  { file: path.join(ROOT, 'public', 'favicon-32.png'),                 size: 32  },
  { file: path.join(ROOT, 'public', 'apple-touch-icon.png'),           size: 180 },
];

(async () => {
  if (!fs.existsSync(SVG_SRC)) {
    console.error('✗ icon-source.svg não encontrado em public/');
    process.exit(1);
  }

  const svg = fs.readFileSync(SVG_SRC);

  for (const { file, size } of ICONS) {
    await sharp(svg).resize(size, size).png().toFile(file);
    console.log(`✓ ${path.basename(file)} (${size}×${size})`);
  }

  console.log('\nÍcones gerados com sucesso!');
})();
