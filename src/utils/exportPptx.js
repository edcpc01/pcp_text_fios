// Geração de PPTX com renderização NATIVA (sem screenshot).
// Tabelas viram tabelas editáveis no PowerPoint; gráficos viram charts nativos.
//
// API:
//   exportReport({
//     title, subtitle, fileName,
//     slides: [
//       { kind: 'chart',         title?, subtitle?, chartType, data, stats? },
//       { kind: 'table',         title?, subtitle?, headers, rows, colWidths? },
//       { kind: 'chartAndTable', title?, subtitle?, chartType, data, stats?, headers, rows, colWidths? },
//       { kind: 'kpi',           title?, subtitle?, cards: [{ label, value, color?, hint? }] },
//       { kind: 'image',         title?, subtitle?, el },  // fallback: captura DOM
//     ]
//   })
//
// Para tabelas grandes, é feita paginação por capítulo (chunks de ~15 linhas)
// reaproveitando título/subtítulo automaticamente.

// ── Layout (polegadas) ───────────────────────────────────────────────────
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const MARGIN_X = 0.4;
const HEADER_H = 0.85;
const FOOTER_H = 0.32;
const CONTENT_TOP    = HEADER_H + 0.18;
const CONTENT_BOTTOM = SLIDE_H - FOOTER_H - 0.10;
const CONTENT_W      = SLIDE_W - MARGIN_X * 2;
const CONTENT_H      = CONTENT_BOTTOM - CONTENT_TOP;

const ROWS_PER_PAGE = 17; // linhas de dados por slide (header repete)

// ── Tema ─────────────────────────────────────────────────────────────────
const C = {
  bg:        '0A1224',
  header:    '111B33',
  accent:    '22D3EE',
  surface:   '0F1A2E',
  border:    '1E293B',
  text:      'E2E8F0',
  textMuted: '94A3B8',
  textHi:    'FFFFFF',
  tierHeader: '111B33',
  zebra:     '111B33',
  level0:    '1E293B',
  level1:    '152033',
  good:      '10B981',
  warn:      'F59E0B',
  bad:       'EF4444',
  cyan:      '22D3EE',
  violet:    'A78BFA',
};

const CHART_PALETTE = ['8B5CF6', 'F97316', '3B82F6', 'EC4899', '10B981', 'F59E0B', '06B6D4', 'A78BFA'];

function sanitizeFile(name) {
  return String(name || 'export').replace(/[\\/:*?"<>|]/g, '').slice(0, 80).trim() || 'export';
}

// ── Header / Footer (decorate por slide) ─────────────────────────────────
function addHeader(slide, title, subtitle) {
  slide.addShape('rect', {
    x: 0, y: 0, w: SLIDE_W, h: HEADER_H,
    fill: { color: C.header }, line: { type: 'none' },
  });
  slide.addShape('rect', {
    x: 0, y: 0, w: 0.14, h: HEADER_H,
    fill: { color: C.accent }, line: { type: 'none' },
  });
  if (title) {
    slide.addText(title, {
      x: MARGIN_X, y: 0.12, w: SLIDE_W - MARGIN_X * 2, h: 0.45,
      fontFace: 'Calibri', fontSize: 22, bold: true, color: C.textHi,
    });
  }
  if (subtitle) {
    slide.addText(subtitle, {
      x: MARGIN_X, y: 0.55, w: SLIDE_W - MARGIN_X * 2, h: 0.28,
      fontFace: 'Calibri', fontSize: 12, color: C.textMuted,
    });
  }
}

function addFooter(slide, pageInfo, stamp) {
  slide.addShape('line', {
    x: MARGIN_X, y: SLIDE_H - FOOTER_H - 0.02, w: SLIDE_W - MARGIN_X * 2, h: 0,
    line: { color: C.border, width: 0.5 },
  });
  slide.addText(`PCP Corradi/Doptex · gerado ${stamp}`, {
    x: MARGIN_X, y: SLIDE_H - FOOTER_H + 0.02, w: 9, h: 0.22,
    fontFace: 'Calibri', fontSize: 9, color: C.textMuted, italic: true,
  });
  if (pageInfo) {
    slide.addText(pageInfo, {
      x: SLIDE_W - MARGIN_X - 3, y: SLIDE_H - FOOTER_H + 0.02, w: 3, h: 0.22,
      fontFace: 'Calibri', fontSize: 9, color: C.textMuted, align: 'right',
    });
  }
}

// ── Renderers ────────────────────────────────────────────────────────────

function renderChart(pptx, slide, data) {
  const { chartType = 'doughnut', data: chartData, stats } = data;
  // chartData = { labels: [...], values: [...], colors?: [...] }
  const colors = chartData.colors && chartData.colors.length
    ? chartData.colors
    : CHART_PALETTE.slice(0, chartData.labels.length);

  const hasStats = Array.isArray(stats) && stats.length > 0;
  const chartX = MARGIN_X;
  const chartY = CONTENT_TOP;
  const chartW = hasStats ? CONTENT_W * 0.65 : CONTENT_W;
  const chartH = CONTENT_H;

  slide.addChart(
    chartType === 'pie' ? pptx.charts.PIE : pptx.charts.DOUGHNUT,
    [{
      name:   data.title || 'Distribuição',
      labels: chartData.labels,
      values: chartData.values,
    }],
    {
      x: chartX, y: chartY, w: chartW, h: chartH,
      chartColors: colors,
      showLegend: true, legendPos: 'r',
      legendFontFace: 'Calibri', legendFontSize: 12, legendColor: C.text,
      showPercent: true,
      dataLabelColor: C.textHi, dataLabelFontSize: 12, dataLabelFontBold: true,
      dataLabelPosition: 'outEnd',
      holeSize: chartType === 'doughnut' ? 55 : undefined,
      titleColor: C.textHi,
      plotArea: { fill: { color: C.bg } },
    }
  );

  if (hasStats) {
    const sx = chartX + chartW + 0.2;
    const sw = SLIDE_W - MARGIN_X - sx;
    const cardH = 0.85;
    const gap = 0.18;
    stats.forEach((stat, i) => {
      const y = chartY + i * (cardH + gap);
      slide.addShape('rect', {
        x: sx, y, w: sw, h: cardH,
        fill: { color: C.surface }, line: { color: C.border, width: 0.5 },
        rectRadius: 0.08,
      });
      slide.addText(stat.label || '', {
        x: sx + 0.15, y: y + 0.08, w: sw - 0.3, h: 0.28,
        fontFace: 'Calibri', fontSize: 10, color: C.textMuted, bold: true,
      });
      slide.addText(String(stat.value || '—'), {
        x: sx + 0.15, y: y + 0.36, w: sw - 0.3, h: 0.42,
        fontFace: 'Calibri', fontSize: 20, bold: true, color: stat.color || C.textHi,
      });
    });
  }
}

function buildTableRows(headers, rows) {
  // headers: ['Coluna', ...] (strings ou {text, align, width})
  // rows: array de objetos { level?: 0..2, cells: [...], bold?, color? }
  const headerRow = headers.map((h) => {
    const text = typeof h === 'string' ? h : h.text;
    const align = typeof h === 'string' ? (h.toLowerCase().includes('máquina') || h.toLowerCase().includes('produto') || h.toLowerCase().includes('empresa') || h.toLowerCase().includes('cliente') ? 'left' : 'right') : (h.align || 'left');
    return {
      text,
      options: {
        bold: true, color: C.textHi, fill: { color: C.tierHeader },
        align, valign: 'middle', fontSize: 11, fontFace: 'Calibri',
      },
    };
  });

  const bodyRows = rows.map((row, idx) => {
    const lvl = row.level ?? 0;
    const fill = lvl === 0
      ? (idx % 2 === 0 ? { color: C.surface } : { color: C.bg })
      : lvl === 1
        ? { color: C.bg }
        : { color: '050B17' };
    const bold = row.bold ?? (lvl === 0);
    const color = row.color || C.text;
    const fontSize = lvl === 0 ? 11 : lvl === 1 ? 10 : 10;
    return row.cells.map((cell, ci) => {
      const isFirst = ci === 0;
      const text = typeof cell === 'string' ? cell : cell.text;
      const cellOpts = typeof cell === 'object' ? cell : {};
      // indenta primeira coluna conforme nível
      const indent = isFirst ? '  '.repeat(lvl) : '';
      return {
        text: indent + (text ?? ''),
        options: {
          bold: cellOpts.bold ?? bold,
          color: cellOpts.color || color,
          fill,
          fontSize: cellOpts.fontSize ?? fontSize,
          fontFace: 'Calibri',
          align: cellOpts.align || (isFirst ? 'left' : 'right'),
          valign: 'middle',
        },
      };
    });
  });

  return { headerRow, bodyRows };
}

function renderTable(slide, data, opts = {}) {
  const { headers, rows, colWidths } = data;
  const { y = CONTENT_TOP, h = CONTENT_H } = opts;
  const { headerRow, bodyRows } = buildTableRows(headers, rows);

  const totalW = CONTENT_W;
  let colW;
  if (colWidths && colWidths.length === headers.length) {
    const sum = colWidths.reduce((a, b) => a + b, 0);
    colW = colWidths.map((c) => (c / sum) * totalW);
  } else {
    // primeira coluna mais larga, demais iguais
    const rest = headers.length - 1;
    if (rest > 0) {
      const restW = totalW * 0.55 / rest;
      colW = [totalW * 0.45, ...Array(rest).fill(restW)];
    } else {
      colW = [totalW];
    }
  }

  slide.addTable([headerRow, ...bodyRows], {
    x: MARGIN_X, y, w: totalW, h,
    colW,
    fontFace: 'Calibri', fontSize: 11,
    border: { type: 'solid', pt: 0.3, color: C.border },
    valign: 'middle',
  });
}

function renderChartAndTable(pptx, slide, data) {
  const { chartType, data: chartData, stats, headers, rows, colWidths } = data;

  // top half: chart
  const chartH = CONTENT_H * 0.48;
  const colors = chartData.colors && chartData.colors.length
    ? chartData.colors
    : CHART_PALETTE.slice(0, chartData.labels.length);

  const hasStats = Array.isArray(stats) && stats.length > 0;
  const chartX = MARGIN_X;
  const chartY = CONTENT_TOP;
  const chartW = hasStats ? CONTENT_W * 0.55 : CONTENT_W;

  slide.addChart(
    chartType === 'pie' ? pptx.charts.PIE : pptx.charts.DOUGHNUT,
    [{ name: data.title || 'Distribuição', labels: chartData.labels, values: chartData.values }],
    {
      x: chartX, y: chartY, w: chartW, h: chartH,
      chartColors: colors,
      showLegend: true, legendPos: 'r',
      legendFontFace: 'Calibri', legendFontSize: 11, legendColor: C.text,
      showPercent: true,
      dataLabelColor: C.textHi, dataLabelFontSize: 11, dataLabelFontBold: true,
      dataLabelPosition: 'outEnd',
      holeSize: chartType === 'doughnut' ? 55 : undefined,
      plotArea: { fill: { color: C.bg } },
    }
  );

  if (hasStats) {
    const sx = chartX + chartW + 0.2;
    const sw = SLIDE_W - MARGIN_X - sx;
    const cardH = 0.70;
    const gap = 0.14;
    stats.forEach((stat, i) => {
      const y = chartY + i * (cardH + gap);
      slide.addShape('rect', {
        x: sx, y, w: sw, h: cardH,
        fill: { color: C.surface }, line: { color: C.border, width: 0.5 },
        rectRadius: 0.08,
      });
      slide.addText(stat.label || '', {
        x: sx + 0.12, y: y + 0.06, w: sw - 0.24, h: 0.24,
        fontFace: 'Calibri', fontSize: 9, color: C.textMuted, bold: true,
      });
      slide.addText(String(stat.value || '—'), {
        x: sx + 0.12, y: y + 0.30, w: sw - 0.24, h: 0.36,
        fontFace: 'Calibri', fontSize: 17, bold: true, color: stat.color || C.textHi,
      });
    });
  }

  // bottom half: table
  const tableY = CONTENT_TOP + chartH + 0.18;
  const tableH = CONTENT_H - chartH - 0.18;
  renderTable(slide, { headers, rows, colWidths }, { y: tableY, h: tableH });
}

function renderKpi(slide, data) {
  const cards = data.cards || [];
  const n = cards.length || 1;
  const gap = 0.25;
  const cardW = (CONTENT_W - gap * (n - 1)) / n;
  cards.forEach((card, i) => {
    const x = MARGIN_X + i * (cardW + gap);
    slide.addShape('rect', {
      x, y: CONTENT_TOP, w: cardW, h: 2.0,
      fill: { color: C.surface }, line: { color: C.border, width: 0.5 },
      rectRadius: 0.12,
    });
    slide.addText(card.label || '', {
      x: x + 0.2, y: CONTENT_TOP + 0.18, w: cardW - 0.4, h: 0.35,
      fontFace: 'Calibri', fontSize: 12, color: C.textMuted, bold: true,
    });
    slide.addText(String(card.value || '—'), {
      x: x + 0.2, y: CONTENT_TOP + 0.55, w: cardW - 0.4, h: 0.85,
      fontFace: 'Calibri', fontSize: 36, bold: true, color: card.color || C.textHi,
    });
    if (card.hint) {
      slide.addText(card.hint, {
        x: x + 0.2, y: CONTENT_TOP + 1.42, w: cardW - 0.4, h: 0.3,
        fontFace: 'Calibri', fontSize: 10, color: C.textMuted, italic: true,
      });
    }
  });
}

async function renderImage(slide, data) {
  if (!data.el) return;
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(data.el, {
    backgroundColor: '#0A1224', useCORS: true, allowTaint: true, scale: 2, logging: false,
    windowWidth: data.el.scrollWidth, windowHeight: data.el.scrollHeight,
  });
  const dataUrl = canvas.toDataURL('image/png');
  const ratio = canvas.width / canvas.height;
  let imgW = CONTENT_W, imgH = CONTENT_W / ratio;
  if (imgH > CONTENT_H) { imgH = CONTENT_H; imgW = CONTENT_H * ratio; }
  const imgX = MARGIN_X + (CONTENT_W - imgW) / 2;
  const imgY = CONTENT_TOP + (CONTENT_H - imgH) / 2;
  slide.addImage({ data: dataUrl, x: imgX, y: imgY, w: imgW, h: imgH });
}

// ── Paginação ────────────────────────────────────────────────────────────
// Expande slides de tipo 'table' / 'chartAndTable' em múltiplos slides
// quando há muitas linhas.

function paginateSlides(slides) {
  const out = [];
  slides.forEach((s) => {
    if (s.kind === 'table' && Array.isArray(s.rows) && s.rows.length > ROWS_PER_PAGE) {
      const chunks = chunk(s.rows, ROWS_PER_PAGE);
      chunks.forEach((rows, idx) => {
        out.push({
          ...s,
          rows,
          _page: idx + 1, _totalPages: chunks.length,
          subtitle: idx === 0 ? s.subtitle : `${s.subtitle || ''}${s.subtitle ? ' · ' : ''}continuação`,
        });
      });
    } else if (s.kind === 'chartAndTable' && Array.isArray(s.rows) && s.rows.length > ROWS_PER_PAGE) {
      // primeira página: chart + N linhas; demais páginas: só tabela
      const first = s.rows.slice(0, ROWS_PER_PAGE);
      const rest  = s.rows.slice(ROWS_PER_PAGE);
      const restChunks = chunk(rest, Math.floor(ROWS_PER_PAGE * 1.8)); // só tabela aceita mais linhas
      out.push({ ...s, rows: first, _page: 1, _totalPages: 1 + restChunks.length });
      restChunks.forEach((rows, idx) => {
        out.push({
          kind: 'table',
          title: s.title, subtitle: `${s.subtitle || ''}${s.subtitle ? ' · ' : ''}continuação`,
          headers: s.headers, colWidths: s.colWidths, rows,
          _page: idx + 2, _totalPages: 1 + restChunks.length,
        });
      });
    } else {
      out.push(s);
    }
  });
  return out;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ── Entry point ──────────────────────────────────────────────────────────
export async function exportReport({ title, subtitle, fileName, slides }) {
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error('Nenhum conteúdo para exportar.');
  }
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout  = 'LAYOUT_WIDE';
  pptx.title   = title;
  pptx.company = 'Corradi / Doptex';

  const stamp = new Date().toLocaleString('pt-BR');
  const expanded = paginateSlides(slides);
  const totalSlides = expanded.length;

  for (let i = 0; i < expanded.length; i++) {
    const sData = expanded[i];
    const slide = pptx.addSlide();
    slide.background = { color: C.bg };

    const slideTitle    = sData.title    ?? title;
    const slideSubtitle = sData.subtitle ?? subtitle;
    addHeader(slide, slideTitle, slideSubtitle);

    const pageInfo = totalSlides > 1
      ? `Slide ${i + 1} de ${totalSlides}`
      : '';
    addFooter(slide, pageInfo, stamp);

    switch (sData.kind) {
      case 'chart':         renderChart(pptx, slide, sData); break;
      case 'table':         renderTable(slide, sData); break;
      case 'chartAndTable': renderChartAndTable(pptx, slide, sData); break;
      case 'kpi':           renderKpi(slide, sData); break;
      case 'image':         await renderImage(slide, sData); break;
      default: throw new Error(`Slide kind desconhecido: ${sData.kind}`);
    }
  }

  const out = fileName || `${sanitizeFile(title)}.pptx`;
  await pptx.writeFile({ fileName: out });
}

// ── Compat: mantém a função antiga para usos que ainda passam targetRef ──
export async function exportElementToPptx(el, opts = {}) {
  return exportReport({
    title: opts.title,
    subtitle: opts.subtitle,
    fileName: opts.fileName,
    slides: [{ kind: 'image', el }],
  });
}
