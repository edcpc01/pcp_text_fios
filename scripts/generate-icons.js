/**
 * Gera os ícones PNG do PWA.
 *
 * Se existir public/doptex-logo.png:
 *   → remove o fundo sólido do logo (deixa só o "D" transparente)
 *   → coloca o "D" nos 62% superiores do ícone sobre fundo #22d3ee
 *   → adiciona silhueta de fábrica branca na faixa inferior
 *
 * Se não existir, usa icon-source.svg como fallback.
 *
 * Roda automaticamente no build da Vercel: "build": "node scripts/generate-icons.js && vite build"
 */

const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');

const ROOT     = path.join(__dirname, '..');
const LOGO     = path.join(ROOT, 'public', 'doptex-logo.png');
const SVG_SRC  = path.join(ROOT, 'public', 'icon-source.svg');
const BG_COLOR = { r: 34, g: 211, b: 238, alpha: 1 }; // #22d3ee – brand-cyan (cor do texto Dashboard)

const ICONS = [
  { file: path.join(ROOT, 'public', 'icons', 'icon-192.png'),          size: 192 },
  { file: path.join(ROOT, 'public', 'icons', 'icon-512.png'),          size: 512 },
  { file: path.join(ROOT, 'public', 'icons', 'icon-maskable-512.png'), size: 512 },
  { file: path.join(ROOT, 'public', 'favicon-32.png'),                 size: 32  },
  { file: path.join(ROOT, 'public', 'apple-touch-icon.png'),           size: 180 },
];

/**
 * Remove o fundo sólido de um PNG.
 * Amostra o pixel do canto superior-esquerdo como cor de fundo
 * e torna transparentes todos os pixels dentro da tolerância.
 */
async function removeBg(inputBuffer, tolerance = 45) {
  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info; // channels = 4 (RGBA)

  // Amostra canto superior-esquerdo como cor de fundo
  const bgR = data[0], bgG = data[1], bgB = data[2];
  console.log(`  → Fundo detectado: rgb(${bgR},${bgG},${bgB}), tolerância ${tolerance}`);

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
    if (diff < tolerance * 3) {
      data[i + 3] = 0; // transparente
    }
  }

  return sharp(Buffer.from(data), { raw: { width, height, channels } })
    .png()
    .toBuffer();
}

/** SVG da fábrica branca, posicionada na faixa inferior do canvas */
function factorySVG(size) {
  const s     = size;
  const fH    = Math.round(s * 0.30);   // 30% do canvas para a fábrica
  const baseY = Math.round(s * 0.97);   // linha do chão
  const cx    = s / 2;
  const sw    = Math.max(2, Math.round(s * 0.018));

  const wSz  = Math.round(s * 0.048);
  const wY   = baseY - Math.round(fH * 0.38);
  const gapW = Math.round(s * 0.075);

  const bodyW = Math.round(s * 0.56);
  const bodyH = Math.round(fH * 0.46);
  const bodyX = cx - bodyW / 2;
  const bodyY = baseY - bodyH;

  const ch = [
    { x: cx - s * 0.19, w: s * 0.065, h: fH * 0.52 },
    { x: cx - s * 0.04, w: s * 0.065, h: fH * 0.65 },
    { x: cx + s * 0.11, w: s * 0.065, h: fH * 0.42 },
  ];

  const chimneys = ch.map(c => {
    const cy = bodyY - c.h;
    return `<rect x="${c.x}" y="${cy}" width="${c.w}" height="${c.h + 2}" rx="${s * 0.01}"
              fill="#22d3ee" stroke="white" stroke-width="${sw}"/>`;
  }).join('');

  const windows = [-1, 0, 1].map(i => {
    const wx = cx + i * gapW - wSz / 2;
    return `<rect x="${wx}" y="${wY - wSz}" width="${wSz}" height="${wSz}" rx="${s * 0.007}"
              fill="white"/>`;
  }).join('');

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
    ${chimneys}
    <rect x="${bodyX}" y="${bodyY}" width="${bodyW}" height="${bodyH}" rx="${s * 0.012}"
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

    // Área reservada para o logo (62% do topo)
    const logoAreaH = Math.round(size * 0.62);

    if (useLogo) {
      // 1. Fundo ciano
      const bg = await sharp({
        create: { width: size, height: size, channels: 4, background: BG_COLOR },
      }).png().toBuffer();

      // 2. Carrega logo, remove fundo sólido → só o "D" com transparência
      const rawLogo   = fs.readFileSync(LOGO);
      const logoNoBg  = await removeBg(rawLogo);

      // 3. Redimensiona o "D" transparente para caber na área de logo
      const pad   = Math.round(size * 0.06);
      const logoW = size - pad * 2;
      const logoH = logoAreaH - pad;

      const logoBuf = await sharp(logoNoBg)
        .resize(logoW, logoH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();

      // 4. Compõe: fundo ciano + "D" (sem fundo) + fábrica branca
      await sharp(bg)
        .composite([
          { input: logoBuf, top: pad, left: pad },
          { input: factory, top: 0,   left: 0   },
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
