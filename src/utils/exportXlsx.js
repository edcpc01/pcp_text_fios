// Export de planilhas XLSX. Usa SheetJS (xlsx) com import dinâmico para
// manter o chunk principal leve — o pacote só é carregado ao clicar exportar.

import { formatDateBR } from './dates';

function sanitizeFile(name) {
  return String(name || 'export').replace(/[\\/:*?"<>|]/g, '').slice(0, 100).trim() || 'export';
}

function pct(planned, actual) {
  return planned > 0 ? Math.round((actual / planned) * 100) : 0;
}

// Constrói os dados para exportar com base na visão selecionada.
//   viewMode  — 'product' | 'machine' | 'daily'
//   rows      — array agregado (sortedData) já filtrado/ordenado como na tela
//   ctx       — { factoryLabel, monthLabel, clientFilter, productFilter }
//
// Para Por Máquina e Por Dia, expande cada item em uma linha-pai (negrito)
// seguida das linhas de produto (indentadas) para refletir a árvore.
export async function exportRealizadoXlsx(viewMode, rows, ctx) {
  const { factoryLabel, monthLabel, clientFilter, productFilter, productFilterLabel } = ctx;

  const XLSX = await import('xlsx');

  const viewTitle = viewMode === 'product' ? 'Por Produto'
                  : viewMode === 'machine' ? 'Por Máquina'
                  : 'Por Dia';
  const colLabel  = viewMode === 'product' ? 'Produto'
                  : viewMode === 'machine' ? 'Máquina'
                  : 'Data';

  // ── Cabeçalho do relatório ────────────────────────────────────────
  const aoa = [
    ['Produção Realizada — ' + viewTitle],
    ['Unidade', factoryLabel],
    ['Mês',     monthLabel],
    ['Cliente', clientFilter === 'all' ? 'Todos' : clientFilter],
    ['Produto', productFilter === 'all' ? 'Todos' : (productFilterLabel || productFilter)],
    [],
  ];

  // ── Headers da tabela ─────────────────────────────────────────────
  aoa.push([colLabel, 'Código', 'Planejado (kg)', 'Realizado (kg)', 'Aderência (%)', 'Desvio (kg)']);

  let totalPlanned = 0;
  let totalActual  = 0;

  rows.forEach((item) => {
    const planned = item.planned || 0;
    const actual  = item.actual  || 0;
    const dev     = actual - planned;
    const p       = pct(planned, actual);
    totalPlanned += planned;
    totalActual  += actual;

    const nameCell = viewMode === 'daily' ? formatDateBR(item.name) : item.name;
    const codeCell = viewMode === 'machine'
      ? (item.machineIds || []).join(' · ')
      : (item.code || '');
    aoa.push([nameCell, codeCell, planned, actual, p / 100, dev]);

    // Sub-linhas: produtos dentro de dia/máquina
    if ((viewMode === 'daily' || viewMode === 'machine') && Array.isArray(item.products)) {
      item.products.forEach((prod) => {
        const pP = prod.planned || 0;
        const pA = prod.actual  || 0;
        const pPct = pct(pP, pA);
        aoa.push(['  ↳ ' + (prod.name || ''), prod.code || '', pP, pA, pPct / 100, pA - pP]);
      });
    }
  });

  // ── Rodapé com totais ─────────────────────────────────────────────
  aoa.push([]);
  aoa.push([
    'TOTAL',
    '',
    totalPlanned,
    totalActual,
    (totalPlanned > 0 ? totalActual / totalPlanned : 0),
    totalActual - totalPlanned,
  ]);

  // ── Cria worksheet ────────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Largura das colunas
  ws['!cols'] = [
    { wch: 48 }, // Produto/Máquina/Data
    { wch: 24 }, // Código
    { wch: 16 }, // Planejado
    { wch: 16 }, // Realizado
    { wch: 14 }, // Aderência
    { wch: 16 }, // Desvio
  ];

  // Formato numérico nas colunas C, D, F (kg) e E (%)
  const HEADER_ROW = 7; // 1-based, linha onde estão os cabeçalhos
  const LAST_ROW   = aoa.length;
  for (let row = HEADER_ROW + 1; row <= LAST_ROW; row++) {
    ['C', 'D', 'F'].forEach((col) => {
      const cell = ws[`${col}${row}`];
      if (cell && typeof cell.v === 'number') {
        cell.z = '#,##0';
      }
    });
    const cellPct = ws[`E${row}`];
    if (cellPct && typeof cellPct.v === 'number') {
      cellPct.z = '0.0%';
    }
  }

  // Mescla células do título
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];

  // ── Workbook ──────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, viewTitle.slice(0, 31)); // limite Excel = 31 chars

  const fileName = sanitizeFile(`Realizado_${viewTitle}_${monthLabel}`) + '.xlsx';
  XLSX.writeFile(wb, fileName);
}
