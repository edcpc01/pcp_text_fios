// Captura um nó do DOM como PNG e exporta em PPTX widescreen, paginando
// automaticamente quando o conteúdo é mais alto do que cabe num slide.
//
// Uso:
//   exportElementToPptx(domEl, { title, subtitle, fileName })
//
// O elemento alvo precisa estar visível na tela. A captura usa o tamanho
// real do nó (scrollWidth × scrollHeight), então conteúdo com overflow
// é capturado por completo.

// ── Layout constants (polegadas — pptxgenjs usa inch) ─────────────────────
const SLIDE_W = 13.333; // LAYOUT_WIDE
const SLIDE_H = 7.5;

const MARGIN_X = 0.35;
const HEADER_H = 0.85;   // banda do cabeçalho (título + subtítulo)
const FOOTER_H = 0.30;   // rodapé fino
const CONTENT_TOP    = HEADER_H + 0.10;
const CONTENT_BOTTOM = SLIDE_H - FOOTER_H - 0.10;
const CONTENT_W      = SLIDE_W - MARGIN_X * 2;
const CONTENT_H      = CONTENT_BOTTOM - CONTENT_TOP;

// Tema (alinhado ao app)
const COLOR_BG       = '0A1224';
const COLOR_HEADER   = '111B33';
const COLOR_ACCENT   = '22D3EE';
const COLOR_TITLE    = 'FFFFFF';
const COLOR_SUBTITLE = '94A3B8';
const COLOR_FOOTER   = '64748B';

function sanitizeFile(name) {
  return String(name || 'export').replace(/[\\/:*?"<>|]/g, '').slice(0, 80).trim() || 'export';
}

// Recorta uma fatia vertical do canvas e retorna como dataURL PNG.
function sliceCanvas(srcCanvas, sy, sh) {
  const out = document.createElement('canvas');
  out.width  = srcCanvas.width;
  out.height = sh;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(srcCanvas, 0, sy, srcCanvas.width, sh, 0, 0, srcCanvas.width, sh);
  return out.toDataURL('image/png');
}

function addHeader(slide, title, subtitle) {
  // Banda do cabeçalho
  slide.addShape('rect', {
    x: 0, y: 0, w: SLIDE_W, h: HEADER_H,
    fill: { color: COLOR_HEADER }, line: { type: 'none' },
  });
  // Filete colorido na lateral esquerda
  slide.addShape('rect', {
    x: 0, y: 0, w: 0.12, h: HEADER_H,
    fill: { color: COLOR_ACCENT }, line: { type: 'none' },
  });
  slide.addText(title, {
    x: MARGIN_X, y: 0.12, w: SLIDE_W - MARGIN_X * 2, h: 0.45,
    fontFace: 'Calibri', fontSize: 22, bold: true, color: COLOR_TITLE,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: MARGIN_X, y: 0.52, w: SLIDE_W - MARGIN_X * 2, h: 0.30,
      fontFace: 'Calibri', fontSize: 12, color: COLOR_SUBTITLE,
    });
  }
}

function addFooter(slide, pageInfo, stamp) {
  slide.addShape('line', {
    x: MARGIN_X, y: SLIDE_H - FOOTER_H - 0.02, w: SLIDE_W - MARGIN_X * 2, h: 0,
    line: { color: '1E293B', width: 0.5 },
  });
  slide.addText(`PCP Corradi/Doptex · gerado ${stamp}`, {
    x: MARGIN_X, y: SLIDE_H - FOOTER_H + 0.03, w: 9, h: 0.22,
    fontFace: 'Calibri', fontSize: 9, color: COLOR_FOOTER, italic: true,
  });
  if (pageInfo) {
    slide.addText(pageInfo, {
      x: SLIDE_W - MARGIN_X - 2, y: SLIDE_H - FOOTER_H + 0.03, w: 2, h: 0.22,
      fontFace: 'Calibri', fontSize: 9, color: COLOR_FOOTER, align: 'right',
    });
  }
}

export async function exportElementToPptx(el, opts = {}) {
  if (!el) throw new Error('Elemento alvo inválido para export.');
  const {
    title    = 'Export',
    subtitle = '',
    fileName,
  } = opts;

  // ── Captura DOM → canvas ────────────────────────────────────────────
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, {
    backgroundColor: '#0A1224',
    useCORS: true,
    allowTaint: true,
    scale: 2,
    logging: false,
    windowWidth:  el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

  // ── Decide single-slide vs multi-slide ──────────────────────────────
  // Aspect ratio da área de conteúdo do slide.
  const slideRatio   = CONTENT_W / CONTENT_H;
  const captureRatio = canvas.width / canvas.height;

  // Em pixels, qual a altura "ideal" para usar a largura toda do slide.
  const targetSliceHeightPx = Math.floor(canvas.width / slideRatio);

  // Se o capture é mais "achatado" que o slide (ex: donut), encaixa num slide só.
  // Se é mais "alto" que o slide, paginamos.
  const slices = [];
  if (captureRatio >= slideRatio) {
    slices.push({ sy: 0, sh: canvas.height });
  } else {
    let y = 0;
    while (y < canvas.height) {
      const sh = Math.min(targetSliceHeightPx, canvas.height - y);
      slices.push({ sy: y, sh });
      y += sh;
    }
  }

  // ── Monta PPTX ──────────────────────────────────────────────────────
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout  = 'LAYOUT_WIDE'; // 13.33 × 7.5
  pptx.title   = title;
  pptx.company = 'Corradi / Doptex';

  const stamp = new Date().toLocaleString('pt-BR');
  const totalPages = slices.length;

  slices.forEach((slice, idx) => {
    const slide = pptx.addSlide();
    slide.background = { color: COLOR_BG };

    addHeader(slide, title, subtitle);

    const partTitle = totalPages > 1 ? `Página ${idx + 1} de ${totalPages}` : '';
    addFooter(slide, partTitle, stamp);

    // Imagem desta fatia, dimensionada para preencher a área de conteúdo.
    const dataUrl = totalPages > 1
      ? sliceCanvas(canvas, slice.sy, slice.sh)
      : canvas.toDataURL('image/png');

    // Mantém aspect ratio da fatia
    const sliceWPx = canvas.width;
    const sliceHPx = slice.sh;
    const sliceRatio = sliceWPx / sliceHPx;

    let imgW = CONTENT_W;
    let imgH = CONTENT_W / sliceRatio;
    if (imgH > CONTENT_H) {
      imgH = CONTENT_H;
      imgW = CONTENT_H * sliceRatio;
    }
    const imgX = MARGIN_X + (CONTENT_W - imgW) / 2;
    const imgY = CONTENT_TOP + (CONTENT_H - imgH) / 2;

    slide.addImage({ data: dataUrl, x: imgX, y: imgY, w: imgW, h: imgH });
  });

  const out = fileName || `${sanitizeFile(title)}.pptx`;
  await pptx.writeFile({ fileName: out });
}
