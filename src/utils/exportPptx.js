// Captura um nó do DOM como PNG e gera um PPTX com a imagem em slide widescreen.
// Usa pptxgenjs (carregado lazy) + html2canvas (já instalado).
//
// Uso:
//   exportElementToPptx(domEl, { title, subtitle, fileName })
//
// O elemento que vai ser capturado deve estar visível na tela. Para tabelas longas
// o capture é feito do tamanho real do conteúdo, não do viewport.

function sanitizeFile(name) {
  return String(name || 'export').replace(/[\\/:*?"<>|]/g, '').slice(0, 80).trim() || 'export';
}

export async function exportElementToPptx(el, opts = {}) {
  if (!el) throw new Error('Elemento alvo inválido para export.');
  const {
    title    = 'Export',
    subtitle = '',
    fileName,
  } = opts;

  // ── Capture DOM → canvas ────────────────────────────────────────────
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(el, {
    backgroundColor: '#0a1224', // fundo do app — evita transparência feia no slide
    useCORS: true,
    allowTaint: true,
    scale: 2, // qualidade dobrada para que números fiquem nítidos no slide
    logging: false,
    // Captura o tamanho real do elemento, não cortado pelo viewport
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });
  const dataUrl = canvas.toDataURL('image/png');

  // ── Monta PPTX ──────────────────────────────────────────────────────
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in (16:9)
  pptx.title  = title;
  pptx.company = 'Corradi / Doptex';

  const slide = pptx.addSlide();
  slide.background = { color: '0A1224' };

  // Cabeçalho do slide
  slide.addText(title, {
    x: 0.4, y: 0.25, w: 12.5, h: 0.45,
    fontFace: 'Calibri', fontSize: 22, bold: true, color: 'FFFFFF',
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.4, y: 0.72, w: 12.5, h: 0.32,
      fontFace: 'Calibri', fontSize: 12, color: '94A3B8',
    });
  }

  // Caixa de conteúdo abaixo do cabeçalho — preserva aspect ratio
  const boxX = 0.4, boxY = subtitle ? 1.12 : 0.85;
  const boxW = 12.55;
  const boxH = 7.5 - boxY - 0.4; // sobra ~0.4in pro rodapé
  const ratio = canvas.width / canvas.height;
  let imgW = boxW, imgH = boxW / ratio;
  if (imgH > boxH) { imgH = boxH; imgW = boxH * ratio; }
  const imgX = boxX + (boxW - imgW) / 2;
  const imgY = boxY + (boxH - imgH) / 2;

  slide.addImage({ data: dataUrl, x: imgX, y: imgY, w: imgW, h: imgH });

  // Rodapé
  const stamp = new Date().toLocaleString('pt-BR');
  slide.addText(`PCP Corradi/Doptex · gerado ${stamp}`, {
    x: 0.4, y: 7.1, w: 12.5, h: 0.3,
    fontFace: 'Calibri', fontSize: 9, color: '64748B', italic: true,
  });

  // ── Salva ───────────────────────────────────────────────────────────
  const out = fileName || `${sanitizeFile(title)}.pptx`;
  await pptx.writeFile({ fileName: out });
}
