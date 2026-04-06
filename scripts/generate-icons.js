/**
 * Gera os ícones PNG do PWA.
 *
 * Se existir public/doptex-logo.png:
 *   → redimensiona a logo para ocupar os 78% superiores do ícone
 *   → adiciona a silhueta de fábrica branca na faixa inferior
 *
 * Se não existir, usa o icon-source.svg como fallback.
 *
 * Roda automaticamente no build da Vercel via: "build": "node scripts/generate-icons.js && vite build"
 */

const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');

const ROOT     = path.join(__dirname, '..');
const LOGO     = path.join(ROOT, 'public', 'doptex-logo.png');
const SVG_SRC  = path.join(ROOT, 'public', 'icon-source.svg');
const BG_COLOR = { r: 34, g: 211, b: 238, alpha: 1 }; // #22d3ee – ciano Doptex

const ICONS = [
  { file: path.join(ROOT, 'public', 'icons', 'icon-192.png'),          size: 192 },
  { file: path.join(ROOT, 'public', 'icons', 'icon-512.png'),          size: 512 },
  { file: path.join(ROOT, 'public', 'icons', 'icon-maskable-512.png'), size: 512 },
  { file: path.join(ROOT, 'public', 'favicon-32.png'),                 size: 32  },
  { file: path.join(ROOT, 'public', 'apple-touch-icon.png'),           size: 180 },
];

/** SVG inline da fábrica branca, posicionada na faixa inferior do canvas */
function factorySVG(size) {
  const s    = size;
  const fH   = Math.round(s * 0.30);  // altura total da área da fábrica (aumentada)
  const baseY = Math.round(s * 0.97); // linha do chão
  const cx   = s / 2;
  const sw   = Math.max(2, Math.round(s * 0.018)); // stroke-width

  // Janelas
  const wSz  = Math.round(s * 0.048);
  const wY   = baseY - Math.round(fH * 0.38);
  const gapW = Math.round(s * 0.075);

  // Corpo principal da fábrica
  const bodyW = Math.round(s * 0.56);
  const bodyH = Math.round(fH * 0.46);
  const bodyX = cx - bodyW / 2;
  const bodyY = baseY - bodyH;

  // Chaminés
  const ch = [
    { x: cx - s*0.19, w: s*0.065, h: fH*0.52 },
    { x: cx - s*0.04, w: s*0.065, h: fH*0.65 },
    { x: cx + s*0.11, w: s*0.065, h: fH*0.42 },
  ];

  const chimneys = ch.map(c => {
    const cy = bodyY - c.h;
    return `<rect x="${c.x}" y="${cy}" width="${c.w}" height="${c.h + 2}" rx="${s*0.01}"
              fill="#22d3ee" stroke="white" stroke-width="${sw}"/>`;
  }).join('');

  const windows = [-1, 0, 1].map(i => {
    const wx = cx + i * gapW - wSz / 2;
    return `<rect x="${wx}" y="${wY - wSz}" width="${wSz}" height="${wSz}" rx="${s*0.007}"
              fill="white"/>`;
  }).join('');

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
    ${chimneys}
    <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="${s*0.012}"
          fill="#22d3ee" stroke="white" stroke-width="${sw}"/>
    ${windows}
  </svg>`);
}

(async () => {
  const useLogo = fs.existsSync(LOGO);
  console.log(useLogo
    ? '✓ Usando doptex-logo.png como base'
    : '⚠ doptex-logo.png não encontrado — usando icon-source.svg');

  for (const { file, size } of ICONS) {
    const factory = factorySVG(size);

    // Área reservada para a logo (62% do topo – logo menor, fábrica maior)
    const logoAreaH = Math.round(size * 0.62);

    if (useLogo) {
      // 1. Fundo azul Doptex
      const bg = await sharp({
        create: { width: size, height: size, channels: 4, background: BG_COLOR },
      }).png().toBuffer();

      // 2. Logo redimensionada para caber nos 78% superiores, com padding lateral
      const pad   = Math.round(size * 0.06);
      const logoW = size - pad * 2;
      const logoH = logoAreaH - pad;

      const logoBuf = await sharp(LOGO)
        .resize(logoW, logoH, { fit: 'contain', background: { ...BG_COLOR } })
        .png()
        .toBuffer();

      // 3. Compositar logo (topo) + fábrica (fundo) sobre o fundo azul
      await sharp(bg)
        .composite([
          { input: logoBuf,  top: pad,  left: pad  },
          { input: factory,  top: 0,    left: 0    },
        ])
        .png()
        .toFile(file);
    } else {
      // Fallback: usa o SVG genérico
      const svg = fs.readFileSync(SVG_SRC);
      await sharp(svg)
        .resize(size, size)
        .composite([{ input: factory, top: 0, left: 0 }])
        .png()
        .toFile(file);
    }

    console.log(`  ✓ ${path.basename(file)} (${size}×${size})`);
  }

  console.log('\nÍcones gerados com sucesso!');
})();
