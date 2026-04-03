import { useEffect, useMemo, useState } from 'react';
import {
  FlaskConical, Package, ChevronLeft, ChevronRight, Pencil, Check, X,
  TrendingDown, AlertTriangle, CheckCircle2, Layers, Calendar,
} from 'lucide-react';
import { useAppStore, useAdminStore, usePlanningStore } from '../hooks/useStore';
import {
  subscribePlanningEntries,
  subscribeRawMaterialStock, saveRawMaterialStock,
  subscribeFinishedGoodsStock, saveFinishedGoodStock,
} from '../services/firebase';
import { getMonthLabel } from '../utils/dates';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtKg(v) {
  if (v == null || isNaN(v)) return '—';
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`;
  return `${Math.round(v)} kg`;
}

function statusInfo(estoque, necessidade) {
  if (necessidade <= 0) return { label: 'Sem necessidade', color: '#64748b', icon: null, bg: 'rgba(100,116,139,0.08)' };
  const ratio = estoque / necessidade;
  if (ratio >= 1.1) return { label: 'OK', color: '#10b981', icon: CheckCircle2, bg: 'rgba(16,185,129,0.08)' };
  if (ratio >= 0.7) return { label: 'Atenção', color: '#f59e0b', icon: AlertTriangle, bg: 'rgba(245,158,11,0.08)' };
  return { label: 'Crítico', color: '#ef4444', icon: TrendingDown, bg: 'rgba(239,68,68,0.08)' };
}

// ─── Inline editable stock value ──────────────────────────────────────────────

function InlineEdit({ value, onSave, label = 'Editar estoque' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const startEdit = () => { setDraft(String(value ?? '')); setEditing(true); };
  const cancel = () => setEditing(false);
  const confirm = async () => { await onSave(Number(draft) || 0); setEditing(false); };

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input
          autoFocus
          type="number"
          min={0}
          className="w-24 bg-brand-surface border border-brand-cyan/40 rounded-lg px-2 py-0.5 text-sm text-white font-mono focus:outline-none focus:border-brand-cyan"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') cancel(); }}
        />
        <span className="text-xs text-brand-muted">kg</span>
        <button onClick={confirm} className="p-0.5 text-brand-success hover:text-green-300 transition-colors"><Check size={13} /></button>
        <button onClick={cancel}  className="p-0.5 text-brand-muted hover:text-white transition-colors"><X size={13} /></button>
      </span>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="group inline-flex items-center gap-1.5 text-white font-mono font-bold hover:text-brand-cyan transition-colors"
      title={label}
    >
      {fmtKg(value)}
      <Pencil size={11} className="text-brand-muted opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ─── MP Card ──────────────────────────────────────────────────────────────────

function MpCard({ mp, stock, onSaveStock }) {
  const estoque = stock?.estoqueKg ?? 0;
  const { label, color, icon: StatusIcon, bg } = statusInfo(estoque, mp.necessidadeKg);
  const pct = mp.necessidadeKg > 0 ? Math.min(100, Math.round((estoque / mp.necessidadeKg) * 100)) : 100;
  const saldo = estoque - mp.necessidadeKg;

  return (
    <div
      className="bg-brand-card border border-brand-border rounded-2xl p-5 flex flex-col gap-4 card-hover relative overflow-hidden transition-all"
      style={{ borderTop: `2px solid ${color}` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-1">Matéria-Prima</p>
          <p className="text-sm font-semibold text-white leading-tight truncate" title={mp.descricao}>{mp.descricao}</p>
          {mp.codigoMicrodata && (
            <p className="text-[11px] text-brand-muted mt-0.5 font-mono">Cód. {mp.codigoMicrodata}</p>
          )}
        </div>
        <span
          className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
          style={{ backgroundColor: bg, color }}
        >
          {StatusIcon && <StatusIcon size={10} />}
          {label}
        </span>
      </div>

      {/* Barra */}
      <div>
        <div className="flex justify-between text-[10px] text-brand-muted mb-1.5">
          <span>Estoque vs Necessidade</span>
          <span style={{ color }}>{pct}%</span>
        </div>
        <div className="h-2 bg-brand-surface rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
      </div>

      {/* Valores */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="bg-brand-surface rounded-xl p-2.5">
          <p className="text-[9px] text-brand-muted uppercase tracking-widest mb-1">Necessidade</p>
          <p className="text-base font-mono font-bold text-white">{fmtKg(mp.necessidadeKg)}</p>
        </div>
        <div className="bg-brand-surface rounded-xl p-2.5">
          <p className="text-[9px] text-brand-muted uppercase tracking-widest mb-1">Estoque (Microdata)</p>
          <InlineEdit
            value={estoque}
            label="Clique para editar o estoque"
            onSave={(v) => onSaveStock(mp.codigoMicrodata, { descricao: mp.descricao, estoqueKg: v })}
          />
        </div>
      </div>

      {/* Saldo */}
      <div className="flex items-center justify-between border-t border-brand-border pt-3 text-xs">
        <span className="text-brand-muted">Saldo</span>
        <span className="font-mono font-bold" style={{ color: saldo >= 0 ? '#10b981' : '#ef4444' }}>
          {saldo >= 0 ? '+' : ''}{fmtKg(saldo)}
        </span>
      </div>

      {/* Produtos que usam */}
      <div className="text-[10px] text-brand-muted">
        {mp.produtos.length > 0 && (
          <span>Usado em: {mp.produtos.slice(0, 3).join(', ')}{mp.produtos.length > 3 ? ` +${mp.produtos.length - 3}` : ''}</span>
        )}
      </div>
    </div>
  );
}

// ─── Finished Good Card ───────────────────────────────────────────────────────

function PaCard({ product, stock, onSaveStock }) {
  const estoqueKg = stock?.estoqueKg ?? 0;

  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-4 card-hover" style={{ borderTop: '2px solid #8b5cf6' }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-0.5">Produto Acabado</p>
          <p className="text-sm font-semibold text-white truncate">{product.nome}</p>
          <p className="text-[11px] font-mono text-brand-muted mt-0.5">Cód. {product.codigoMicrodata || '—'}</p>
        </div>
        <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400 shrink-0">
          {product.composicao || product.type || '—'}
        </span>
      </div>
      <div className="bg-brand-surface rounded-xl p-3 text-center">
        <p className="text-[9px] text-brand-muted uppercase tracking-widest mb-1">Estoque (Microdata)</p>
        <InlineEdit
          value={estoqueKg}
          label="Clique para editar o estoque de PA"
          onSave={(v) => onSaveStock(product.id, { productName: product.nome, estoqueKg: v })}
        />
      </div>
      {product.comprimentoEnrolamento && (
        <p className="text-[10px] text-brand-muted mt-2 text-center">
          {product.tituloDtex} dtex · {product.comprimentoEnrolamento}m/bobina
        </p>
      )}
    </div>
  );
}

// ─── Date Range Filter ────────────────────────────────────────────────────────

function DateRangeFilter({ dateRange, setDateRange, showPicker, setShowPicker, monthLabel }) {
  const { changeMonth } = useAppStore();
  const hasRange = dateRange.start && dateRange.end;

  return (
    <div className="flex bg-brand-surface border border-brand-border rounded-lg p-1 relative">
      <div className="flex items-center space-x-1">
        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-brand-card rounded text-brand-muted hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <span
          className="text-sm font-medium text-white px-3 capitalize min-w-[140px] text-center cursor-pointer select-none hover:text-brand-cyan transition-colors"
          onDoubleClick={() => setShowPicker(true)}
          title="Duplo clique para filtrar período específico"
        >
          {hasRange
            ? `${dateRange.start.split('-').reverse().join('/')} → ${dateRange.end.split('-').reverse().join('/')}`
            : monthLabel}
        </span>
        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-brand-card rounded text-brand-muted hover:text-white transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      {showPicker && (
        <div className="absolute top-[calc(100%+0.5rem)] right-0 z-50 bg-brand-card border border-brand-border rounded-xl p-4 shadow-xl flex flex-col gap-3 animate-fade-in shadow-black/50 min-w-[260px]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">Data Inicial</label>
              <input
                type="date"
                className="bg-brand-surface text-white text-sm rounded border border-brand-border p-2 focus:outline-none focus:border-brand-cyan"
                value={dateRange.start}
                onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">Data Final</label>
              <input
                type="date"
                className="bg-brand-surface text-white text-sm rounded border border-brand-border p-2 focus:outline-none focus:border-brand-cyan"
                value={dateRange.end}
                min={dateRange.start}
                onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-1">
            <button onClick={() => { setDateRange({ start: '', end: '' }); setShowPicker(false); }}
              className="text-xs text-brand-muted hover:text-white px-3 py-1.5 rounded transition-colors">Limpar</button>
            <button onClick={() => setShowPicker(false)}
              className="text-xs bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 font-bold rounded px-4 py-1.5 hover:bg-brand-cyan/20 transition-colors">Aplicar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Materiais() {
  const { factory, month, getYearMonth } = useAppStore();
  const { products } = useAdminStore();
  const { entriesMap, setEntriesFromArray } = usePlanningStore();

  const yearMonth = getYearMonth();
  const monthLabel = getMonthLabel(month.year, month.month);

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showPicker, setShowPicker] = useState(false);
  const [mpStock, setMpStock]   = useState({});  // { [codigoMicrodata]: { estoqueKg, ... } }
  const [paStock, setPaStock]   = useState({});  // { [productId]: { estoqueKg, ... } }

  // Reset range on month change
  useEffect(() => { setDateRange({ start: '', end: '' }); setShowPicker(false); }, [yearMonth]);

  // Subscribe planning entries for current month + factory
  useEffect(() => {
    const unsub = subscribePlanningEntries(factory, yearMonth, (data) => {
      setEntriesFromArray(data);
    });
    return unsub;
  }, [factory, yearMonth]);

  // Subscribe MP & PA stock (global, not factory-specific)
  useEffect(() => {
    const unsubMp = subscribeRawMaterialStock(setMpStock);
    const unsubPa = subscribeFinishedGoodsStock(setPaStock);
    return () => { unsubMp(); unsubPa(); };
  }, []);

  const hasRange = dateRange.start && dateRange.end;

  // Filter planning entries by period
  const planningEntries = useMemo(() => {
    const all = Object.values(entriesMap).filter(
      (e) => (e.cellType === 'producao' || !e.cellType) && e.factory === factory,
    );
    if (!hasRange) return all;
    return all.filter((e) => e.date >= dateRange.start && e.date <= dateRange.end);
  }, [entriesMap, factory, hasRange, dateRange]);

  // Build MP necessity map
  const mpNecessidade = useMemo(() => {
    const map = {}; // { codigoMicrodata: { descricao, codigoMicrodata, necessidadeKg, produtos: Set } }

    planningEntries.forEach((entry) => {
      const product = products.find((p) => p.id === entry.product || p.nome === entry.productName);
      if (!product) return;
      const kg = entry.planned || 0;
      if (kg === 0) return;

      // Helper to accumulate
      const accumulate = (mp, pct) => {
        if (!mp?.codigoMicrodata && !mp?.descricao) return;
        const code = mp.codigoMicrodata || mp.descricao;
        if (!map[code]) {
          map[code] = {
            codigoMicrodata: mp.codigoMicrodata || '',
            descricao: mp.descricao || code,
            necessidadeKg: 0,
            produtos: new Set(),
          };
        }
        map[code].necessidadeKg += kg * (pct / 100);
        map[code].produtos.add(product.nome || product.id);
      };

      // Alma
      if (product.alma?.composicaoPct > 0) {
        accumulate(product.alma, product.alma.composicaoPct);
      }
      // Efeito
      if (product.efeito?.composicaoPct > 0) {
        accumulate(product.efeito, product.efeito.composicaoPct);
      }

      // Fallback: produto sem ficha (usa campos legados name/type)
      if (!product.alma && !product.efeito) {
        const code = product.id;
        if (!map[code]) {
          map[code] = { codigoMicrodata: '', descricao: product.nome || product.id, necessidadeKg: 0, produtos: new Set() };
        }
        map[code].necessidadeKg += kg;
        map[code].produtos.add(product.nome || product.id);
      }
    });

    // Convert Sets to arrays
    return Object.values(map)
      .map((m) => ({ ...m, produtos: [...m.produtos] }))
      .sort((a, b) => b.necessidadeKg - a.necessidadeKg);
  }, [planningEntries, products]);

  // Summary KPIs
  const totalNecessidade = mpNecessidade.reduce((s, m) => s + m.necessidadeKg, 0);
  const totalEstoque = mpNecessidade.reduce((s, m) => s + (mpStock[m.codigoMicrodata || m.descricao]?.estoqueKg ?? 0), 0);
  const criticas = mpNecessidade.filter((m) => {
    const est = mpStock[m.codigoMicrodata || m.descricao]?.estoqueKg ?? 0;
    return m.necessidadeKg > 0 && est < m.necessidadeKg * 0.7;
  }).length;
  const totalPlannedKg = planningEntries.reduce((s, e) => s + (e.planned || 0), 0);

  // Products with at least one field (for PA cards)
  const productsWithCode = products.filter((p) => p.codigoMicrodata || p.nome);

  return (
    <div className="p-6 space-y-8 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FlaskConical size={20} className="text-brand-cyan" />
            Consumo de Matéria-Prima
          </h1>
          <p className="text-sm text-brand-muted mt-0.5 capitalize">
            {hasRange
              ? `${dateRange.start.split('-').reverse().join('/')} → ${dateRange.end.split('-').reverse().join('/')}`
              : monthLabel}
            {' · '}{factory === 'matriz' ? 'Corradi Matriz' : 'Corradi Filial'}
          </p>
        </div>
        <DateRangeFilter
          dateRange={dateRange}
          setDateRange={setDateRange}
          showPicker={showPicker}
          setShowPicker={setShowPicker}
          monthLabel={monthLabel}
        />
      </div>

      {/* ── KPI Summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5" style={{ borderTop: '2px solid #22d3ee' }}>
          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-2">Produção Planejada</p>
          <p className="text-3xl font-mono font-bold text-white">{fmtKg(totalPlannedKg)}</p>
          <p className="text-xs text-brand-muted mt-1">{planningEntries.length} entradas no período</p>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5" style={{ borderTop: '2px solid #f97316' }}>
          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-2">Necessidade Total MP</p>
          <p className="text-3xl font-mono font-bold text-white">{fmtKg(totalNecessidade)}</p>
          <p className="text-xs text-brand-muted mt-1">{mpNecessidade.length} tipos de MP</p>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5" style={{ borderTop: '2px solid #10b981' }}>
          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-2">Estoque MP (Microdata)</p>
          <p className="text-3xl font-mono font-bold text-white">{fmtKg(totalEstoque)}</p>
          <p className="text-xs mt-1" style={{ color: totalEstoque >= totalNecessidade ? '#10b981' : '#f59e0b' }}>
            Saldo {totalEstoque >= totalNecessidade ? '+' : ''}{fmtKg(totalEstoque - totalNecessidade)}
          </p>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5" style={{ borderTop: '2px solid #ef4444' }}>
          <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest mb-2">MP Críticas</p>
          <p className="text-3xl font-mono font-bold text-white">{criticas}</p>
          <p className="text-xs text-brand-muted mt-1">estoque {'<'} 70% da necessidade</p>
        </div>
      </div>

      {/* ── MP Cards ── */}
      <div>
        <h2 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4 flex items-center gap-2">
          <FlaskConical size={13} className="text-brand-cyan" />
          Matéria-Prima — Necessidade vs Estoque Microdata
          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-md bg-brand-surface border border-brand-border">
            Clique no estoque para editar
          </span>
        </h2>

        {mpNecessidade.length === 0 ? (
          <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
            <FlaskConical size={32} className="text-brand-muted mx-auto mb-3 opacity-30" />
            <p className="text-brand-muted text-sm">Nenhum planejamento encontrado para o período.</p>
            <p className="text-brand-muted text-xs mt-1">Verifique se há entradas de planejamento com produtos cadastrados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {mpNecessidade.map((mp) => {
              const stockKey = mp.codigoMicrodata || mp.descricao;
              return (
                <MpCard
                  key={stockKey}
                  mp={mp}
                  stock={mpStock[stockKey]}
                  onSaveStock={saveRawMaterialStock}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── Detalhamento por Produto ── */}
      {planningEntries.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <Layers size={13} className="text-brand-cyan" />
            Detalhamento por Produto
          </h2>
          <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border">
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest">Produto</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest">Planejado</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest">MP Alma</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest">Qtd Alma</th>
                    <th className="text-left px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest hidden md:table-cell">MP Efeito</th>
                    <th className="text-right px-5 py-3 text-[10px] font-bold text-brand-muted uppercase tracking-widest hidden md:table-cell">Qtd Efeito</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Aggregate by product
                    const byProduct = {};
                    planningEntries.forEach((e) => {
                      const key = e.product || e.productName || 'N/A';
                      if (!byProduct[key]) {
                        byProduct[key] = {
                          productName: e.productName || e.product || 'N/A',
                          product: e.product,
                          totalKg: 0,
                        };
                      }
                      byProduct[key].totalKg += e.planned || 0;
                    });

                    return Object.values(byProduct)
                      .sort((a, b) => b.totalKg - a.totalKg)
                      .map((row, i) => {
                        const product = products.find((p) => p.id === row.product || p.nome === row.productName);
                        const almaDesc = product?.alma?.descricao || '—';
                        const almaPct  = product?.alma?.composicaoPct || 0;
                        const efeitoDesc = product?.efeito?.descricao || (product?.efeito?.composicaoPct > 0 ? 'N/I' : '—');
                        const efeitoPct  = product?.efeito?.composicaoPct || 0;

                        return (
                          <tr key={row.productName} className={`border-b border-brand-border/50 hover:bg-brand-surface/50 transition-colors ${i % 2 === 0 ? '' : 'bg-brand-surface/20'}`}>
                            <td className="px-5 py-3 text-white font-medium">{row.productName}</td>
                            <td className="px-5 py-3 text-right font-mono text-brand-cyan">{fmtKg(row.totalKg)}</td>
                            <td className="px-5 py-3 text-brand-muted text-xs">{almaDesc}</td>
                            <td className="px-5 py-3 text-right font-mono text-white">
                              {almaPct > 0 ? fmtKg(row.totalKg * almaPct / 100) : '—'}
                              {almaPct > 0 && <span className="text-brand-muted text-[10px] ml-1">({almaPct}%)</span>}
                            </td>
                            <td className="px-5 py-3 text-brand-muted text-xs hidden md:table-cell">{efeitoDesc !== '—' ? efeitoDesc : '—'}</td>
                            <td className="px-5 py-3 text-right font-mono text-white hidden md:table-cell">
                              {efeitoPct > 0 ? fmtKg(row.totalKg * efeitoPct / 100) : '—'}
                              {efeitoPct > 0 && <span className="text-brand-muted text-[10px] ml-1">({efeitoPct}%)</span>}
                            </td>
                          </tr>
                        );
                      });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Estoque de Produto Acabado ── */}
      <div>
        <h2 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4 flex items-center gap-2">
          <Package size={13} className="text-violet-400" />
          Estoque de Produto Acabado (Microdata)
          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-md bg-brand-surface border border-brand-border">
            Clique no valor para editar
          </span>
        </h2>

        {productsWithCode.length === 0 ? (
          <div className="bg-brand-card border border-brand-border rounded-2xl p-12 text-center">
            <Package size={32} className="text-brand-muted mx-auto mb-3 opacity-30" />
            <p className="text-brand-muted text-sm">Nenhum produto cadastrado ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {productsWithCode.map((product) => (
              <PaCard
                key={product.id}
                product={product}
                stock={paStock[product.id]}
                onSaveStock={saveFinishedGoodStock}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
