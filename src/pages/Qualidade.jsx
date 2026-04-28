import { useState, useMemo } from 'react';
import {
  Award, ChevronLeft, ChevronRight, ChevronDown,
  AlertTriangle, Building2, Activity,
} from 'lucide-react';
import { useAppStore, useCsvStore } from '../hooks/useStore';
import { getMonthLabel } from '../utils/dates';

// ─── Constantes ───────────────────────────────────────────────────────────────

const SEGUNDA = new Set(['A3', 'DV', '38']);
const REFUGO  = new Set(['AS', 'EJ', 'EI', 'EM', 'EP']);

const FACTORY_META = {
  matriz: { label: 'Corradi Matriz', dot: '#38bdf8' },
  filial: { label: 'Corradi Filial', dot: '#a78bfa' },
  outra:  { label: 'Outras',         dot: '#6b7280' },
};

function getFactory(emp) {
  const cod = String(emp || '').replace(/^0+/, '');
  if (cod === '9') return 'matriz';
  if (cod === '7') return 'filial';
  return 'outra';
}

function fmtKg(v) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}t`;
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

function pctN(part, total) {
  return total > 0 ? (part / total) * 100 : 0;
}

function getTier(classif, lote) {
  const c = (classif || '').toUpperCase().trim();
  const l = (lote    || '').toUpperCase().trim();
  if (REFUGO.has(c))           return 'refugo';
  if (SEGUNDA.has(c))          return 'segunda';
  if (l.endsWith('A'))         return 'segunda';
  return 'primeira';
}

// ─── Colunas de métricas (compartilhadas entre os níveis) ─────────────────────

function MetricCols({ primeira, segunda, refugo, total }) {
  const p2   = pctN(segunda, total);
  const pRef = pctN(refugo,  total);
  const p1   = pctN(primeira, total);
  return (
    <>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <span className="text-sm font-mono font-semibold text-emerald-400">{fmtKg(primeira)}</span>
        <span className="text-[10px] text-brand-muted/60 ml-1">kg</span>
        <span className="text-[10px] text-emerald-400/70 ml-1.5">({p1.toFixed(1)}%)</span>
      </td>

      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        {segunda > 0 ? (
          <>
            <span className="text-sm font-mono font-semibold text-amber-400">{fmtKg(segunda)}</span>
            <span className="text-[10px] text-brand-muted/60 ml-1">kg</span>
            <span className="text-[10px] text-amber-400/70 ml-1.5">({p2.toFixed(1)}%)</span>
          </>
        ) : <span className="text-xs text-brand-muted/25">—</span>}
      </td>

      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        {refugo > 0 ? (
          <>
            <span className="text-sm font-mono font-semibold text-red-400">{fmtKg(refugo)}</span>
            <span className="text-[10px] text-brand-muted/60 ml-1">kg</span>
            <span className="text-[10px] text-red-400/70 ml-1.5">({pRef.toFixed(1)}%)</span>
          </>
        ) : <span className="text-xs text-brand-muted/25">—</span>}
      </td>

      <td className="px-3 py-2.5 pr-4 text-right whitespace-nowrap">
        <span className="text-sm font-mono font-semibold text-white">{fmtKg(total)}</span>
        <span className="text-[10px] text-brand-muted/60 ml-1">kg</span>
      </td>

      <td className="px-3 py-2.5 pr-5 w-32">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 bg-brand-surface/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(p1, 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-emerald-400 w-10 text-right shrink-0">
            {p1.toFixed(1)}%
          </span>
        </div>
      </td>
    </>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function Qualidade() {
  const { factory, month, changeMonth, getYearMonth } = useAppStore();
  const { rows: allRows, fileName: csvFile, lastSync } = useCsvStore();

  const [expandedFactories, setExpandedFactories] = useState(new Set(['matriz', 'filial']));
  const [expandedMachines,  setExpandedMachines]  = useState(new Set());

  const yearMonth  = getYearMonth();
  const monthLabel = getMonthLabel(month.year, month.month);

  // ─── Árvore Empresa → Máquina → Produto ─────────────────────────────────────

  const tree = useMemo(() => {
    const filtered = allRows.filter((r) => {
      if (!r.date.startsWith(yearMonth)) return false;
      if (factory !== 'all' && getFactory(r.empresa) !== factory) return false;
      return true;
    });

    const factMap = {};

    for (const r of filtered) {
      const fKey = getFactory(r.empresa);
      const mKey = r.machine || '(sem máquina)';
      const pKey = `${r.productCode}||${r.productName || r.productCode}`;
      const t    = getTier(r.classif, r.lote);

      if (!factMap[fKey]) {
        const meta = FACTORY_META[fKey] || FACTORY_META.outra;
        factMap[fKey] = { label: meta.label, dot: meta.dot, primeira: 0, segunda: 0, refugo: 0, total: 0, machines: {} };
      }
      factMap[fKey][t]    += r.quantity;
      factMap[fKey].total += r.quantity;

      const mach = factMap[fKey].machines;
      if (!mach[mKey]) mach[mKey] = { primeira: 0, segunda: 0, refugo: 0, total: 0, products: {} };
      mach[mKey][t]    += r.quantity;
      mach[mKey].total += r.quantity;

      const prods = mach[mKey].products;
      if (!prods[pKey]) {
        const [code, ...rest] = pKey.split('||');
        prods[pKey] = { code, name: rest.join('||') || code, primeira: 0, segunda: 0, refugo: 0, total: 0 };
      }
      prods[pKey][t]    += r.quantity;
      prods[pKey].total += r.quantity;
    }

    return factMap;
  }, [allRows, yearMonth, factory]);

  // ─── KPIs globais ────────────────────────────────────────────────────────────

  const totalKg    = Object.values(tree).reduce((s, f) => s + f.total,    0);
  const primeiraKg = Object.values(tree).reduce((s, f) => s + f.primeira, 0);
  const segundaKg  = Object.values(tree).reduce((s, f) => s + f.segunda,  0);
  const refugoKg   = Object.values(tree).reduce((s, f) => s + f.refugo,   0);

  const toggleFactory = (fKey) =>
    setExpandedFactories((prev) => { const n = new Set(prev); n.has(fKey) ? n.delete(fKey) : n.add(fKey); return n; });

  const toggleMachine = (key) =>
    setExpandedMachines((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const factoryLabel = factory === 'all' ? 'Todas as Unidades' : factory === 'matriz' ? 'Corradi Matriz' : 'Corradi Filial';

  return (
    <div className="flex flex-col h-full min-h-0 overflow-x-hidden">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-brand-border shrink-0 gap-2">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 tracking-tight">
            <Award size={18} className="text-brand-cyan shrink-0" />
            Qualidade
          </h1>
          <p className="text-[10px] text-brand-muted mt-0.5 uppercase tracking-widest font-black">
            {monthLabel} · {factoryLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-brand-surface/50 rounded-xl p-1 border border-brand-border">
            <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-white/[0.06] rounded-xl transition-colors text-brand-muted hover:text-white">
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs font-bold text-white px-2 min-w-[90px] text-center capitalize">
              {new Date(month.year, month.month).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
            </span>
            <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-white/[0.06] rounded-xl transition-colors text-brand-muted hover:text-white">
              <ChevronRight size={15} />
            </button>
          </div>

          {/* CSV status — updated via Realizado sync */}
          {csvFile ? (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border bg-brand-cyan/5 border-brand-cyan/10 text-brand-muted">
              <Activity size={11} className="text-brand-cyan shrink-0" />
              <span className="font-mono text-white truncate max-w-[120px]">{csvFile}</span>
              {lastSync && (
                <span>· {(lastSync instanceof Date ? lastSync : new Date(lastSync))
                  .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-brand-border text-brand-muted/60">
              <Activity size={11} className="shrink-0" />
              Sincronize em Realizado
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="px-4 sm:px-6 py-3 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-brand-border shrink-0">
        <div className="rounded-xl p-3.5 border border-brand-border bg-white/[0.02]">
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">Total Produzido</p>
          <p className="text-xl font-mono font-bold text-white">{fmtKg(totalKg)}<span className="text-xs font-normal text-brand-muted ml-1">kg</span></p>
          <p className="text-[10px] text-brand-muted/60 mt-1">{monthLabel}</p>
        </div>

        <div className="rounded-xl p-3.5 border border-emerald-500/20 bg-emerald-500/[0.05]">
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">1ª Qualidade</p>
          <p className="text-xl font-mono font-bold text-emerald-400">{fmtKg(primeiraKg)}<span className="text-xs font-normal text-brand-muted ml-1">kg</span></p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="flex-1 h-1 bg-brand-bg/40 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pctN(primeiraKg, totalKg)}%` }} />
            </div>
            <span className="text-[10px] font-mono text-emerald-400">{pctN(primeiraKg, totalKg).toFixed(1)}%</span>
          </div>
        </div>

        <div className="rounded-xl p-3.5 border border-amber-500/20 bg-amber-500/[0.05]">
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">2ª Qualidade</p>
          <p className="text-xl font-mono font-bold text-amber-400">{fmtKg(segundaKg)}<span className="text-xs font-normal text-brand-muted ml-1">kg</span></p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="flex-1 h-1 bg-brand-bg/40 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pctN(segundaKg, totalKg)}%` }} />
            </div>
            <span className="text-[10px] font-mono text-amber-400">{pctN(segundaKg, totalKg).toFixed(1)}%</span>
          </div>
          <p className="text-[9px] text-brand-muted/50 mt-1">A3, DV</p>
        </div>

        <div className={`rounded-xl p-3.5 border ${refugoKg > 0 ? 'border-red-500/20 bg-red-500/[0.05]' : 'border-brand-border bg-white/[0.02]'}`}>
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">Refugo / Sucata</p>
          <div className="flex items-center gap-1.5">
            {refugoKg > 0 && <AlertTriangle size={13} className="text-red-400 shrink-0" />}
            <p className={`text-xl font-mono font-bold ${refugoKg > 0 ? 'text-red-400' : 'text-brand-muted'}`}>
              {fmtKg(refugoKg)}<span className="text-xs font-normal text-brand-muted ml-1">kg</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="flex-1 h-1 bg-brand-bg/40 rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full" style={{ width: `${pctN(refugoKg, totalKg)}%` }} />
            </div>
            <span className="text-[10px] font-mono text-red-400">{pctN(refugoKg, totalKg).toFixed(1)}%</span>
          </div>
          <p className="text-[9px] text-brand-muted/50 mt-1">AS, EJ, EI, EM, EP</p>
        </div>
      </div>

      {/* Árvore interativa */}
      <div className="flex-1 overflow-auto w-full">
        {Object.keys(tree).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 rounded-full bg-brand-surface/40 flex items-center justify-center mb-3">
              <Award size={20} className="text-brand-muted/60" />
            </div>
            <p className="text-sm text-brand-muted">Nenhum dado de qualidade encontrado</p>
            <p className="text-xs text-brand-muted/60 mt-1">Sincronize o CSV na página Realizado para carregar os dados</p>
          </div>
        ) : (
          <table className="w-full border-collapse" style={{ minWidth: 780 }}>
            <thead>
              <tr className="sticky top-0 z-10 bg-brand-bg/95 backdrop-blur-sm border-b border-brand-border">
                <th className="pl-5 pr-3 py-3 text-left text-[10px] font-semibold text-brand-muted uppercase tracking-wider">
                  Empresa / Máquina / Produto
                </th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wider">1ª Qualidade</th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider">2ª Qualidade</th>
                <th className="px-3 py-3 text-right text-[10px] font-semibold text-red-400/80 uppercase tracking-wider">Refugo / Sucata</th>
                <th className="px-3 py-3 pr-4 text-right text-[10px] font-semibold text-brand-muted uppercase tracking-wider">Total</th>
                <th className="px-3 py-3 pr-5 text-left text-[10px] font-semibold text-brand-muted uppercase tracking-wider w-36">1ª %</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(tree).map(([fKey, fData]) => {
                const fExpanded = expandedFactories.has(fKey);
                const machines  = Object.entries(fData.machines).sort((a, b) => b[1].total - a[1].total);

                return (
                  <>
                    {/* ── Nível 1: Empresa ── */}
                    <tr key={fKey}
                      className="cursor-pointer hover:bg-white/[0.04] transition-colors border-b border-brand-border/60 bg-white/[0.02]"
                      onClick={() => toggleFactory(fKey)}>
                      <td className="pl-4 pr-3 py-3">
                        <div className="flex items-center gap-2">
                          <ChevronDown size={13} className={`text-brand-muted transition-transform duration-200 shrink-0 ${fExpanded ? '' : '-rotate-90'}`} />
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: fData.dot }} />
                          <Building2 size={13} className="text-brand-muted/50 shrink-0" />
                          <span className="text-sm font-bold text-white">{fData.label}</span>
                        </div>
                      </td>
                      <MetricCols primeira={fData.primeira} segunda={fData.segunda} refugo={fData.refugo} total={fData.total} />
                    </tr>

                    {/* ── Nível 2: Máquinas ── */}
                    {fExpanded && machines.map(([mKey, mData]) => {
                      const mExpKey   = `${fKey}__${mKey}`;
                      const mExpanded = expandedMachines.has(mExpKey);
                      const products  = Object.values(mData.products).sort((a, b) => b.total - a.total);

                      return (
                        <>
                          <tr key={mExpKey}
                            className="cursor-pointer hover:bg-white/[0.03] transition-colors border-b border-brand-border/40"
                            onClick={() => toggleMachine(mExpKey)}>
                            <td className="pr-3 py-2.5" style={{ paddingLeft: 40 }}>
                              <div className="flex items-center gap-2">
                                <ChevronDown size={12} className={`text-brand-muted/60 transition-transform duration-200 shrink-0 ${mExpanded ? '' : '-rotate-90'}`} />
                                <span className="text-xs font-semibold text-white/80">{mKey}</span>
                              </div>
                            </td>
                            <MetricCols primeira={mData.primeira} segunda={mData.segunda} refugo={mData.refugo} total={mData.total} />
                          </tr>

                          {/* ── Nível 3: Produtos ── */}
                          {mExpanded && products.map((prod) => (
                            <tr key={`${mExpKey}__${prod.code}`}
                              className="hover:bg-white/[0.015] transition-colors border-b border-brand-border/25">
                              <td className="pr-3 py-2" style={{ paddingLeft: 68 }}>
                                <span className="text-xs text-brand-muted/80">{prod.name}</span>
                                <span className="text-[10px] text-brand-muted/40 ml-2">{prod.code}</span>
                              </td>
                              <MetricCols primeira={prod.primeira} segunda={prod.segunda} refugo={prod.refugo} total={prod.total} />
                            </tr>
                          ))}
                        </>
                      );
                    })}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
