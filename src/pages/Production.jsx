import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Download, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAppStore, useProductionStore, usePlanningStore, MACHINES } from '../hooks/useStore';
import { subscribeProductionRecords } from '../services/firebase';
import { getMonthLabel, getDaysInMonth, isSunday } from '../utils/dates';
import { seedDemoData } from '../utils/seedData';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAdherenceColor(pct) {
  if (pct >= 95) return { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  if (pct >= 85) return { bar: 'bg-sky-500',     text: 'text-sky-400',     bg: 'bg-sky-500/10' };
  if (pct >= 70) return { bar: 'bg-amber-500',   text: 'text-amber-400',   bg: 'bg-amber-500/10' };
  return          { bar: 'bg-red-500',            text: 'text-red-400',     bg: 'bg-red-500/10' };
}

function getStatusBadge(pct) {
  if (pct >= 95) return { label: 'Excelente', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' };
  if (pct >= 85) return { label: 'Bom',       cls: 'bg-sky-500/15 text-sky-400 border-sky-500/20' };
  if (pct >= 70) return { label: 'Atenção',   cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' };
  return               { label: 'Crítico',    cls: 'bg-red-500/15 text-red-400 border-red-500/20' };
}

function AdherenceIcon({ pct }) {
  if (pct >= 95) return <TrendingUp size={13} className="text-emerald-400" />;
  if (pct >= 70) return <Minus size={13} className="text-amber-400" />;
  return <TrendingDown size={13} className="text-red-400" />;
}

// ─── Row de produto ───────────────────────────────────────────────────────────

function ProductRow({ item, rank }) {
  const pct = item.planned > 0 ? Math.round((item.actual / item.planned) * 100) : 0;
  const colors = getAdherenceColor(pct);
  const badge = getStatusBadge(pct);
  const barWidth = Math.min(pct, 120); // cap visual em 120%

  return (
    <tr className="group hover:bg-white/[0.025] transition-colors border-b border-brand-border">
      {/* Rank */}
      <td className="pl-6 pr-2 py-4 w-8">
        <span className="text-xs font-mono text-brand-muted/60">{rank}</span>
      </td>

      {/* Produto */}
      <td className="px-4 py-4">
        <div>
          <span className="text-sm font-semibold text-white">{item.name}</span>
          {item.machine && (
            <span className="ml-2 text-[10px] text-brand-muted/60">{item.machine}</span>
          )}
        </div>
      </td>

      {/* Planejado */}
      <td className="px-4 py-4 text-right">
        <span className="text-sm font-mono text-white">
          {item.planned.toLocaleString('pt-BR')}
        </span>
        <span className="text-[10px] text-brand-muted/60 ml-1">kg</span>
      </td>

      {/* Realizado */}
      <td className="px-4 py-4 text-right">
        <span className={`text-sm font-mono font-semibold ${colors.text}`}>
          {item.actual.toLocaleString('pt-BR')}
        </span>
        <span className="text-[10px] text-brand-muted/60 ml-1">kg</span>
      </td>

      {/* Barra de aderência */}
      <td className="px-4 py-4 min-w-[140px]">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <AdherenceIcon pct={pct} />
              <span className={`text-xs font-mono font-bold ${colors.text}`}>{pct}%</span>
            </div>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <div className="h-1.5 bg-brand-surface/80 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${colors.bar}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>
      </td>

      {/* Desvio */}
      <td className="px-4 py-4 text-right pr-6">
        {item.planned > 0 && (
          <span className={`text-xs font-mono ${item.actual >= item.planned ? 'text-emerald-400' : 'text-red-400'}`}>
            {item.actual >= item.planned ? '+' : ''}
            {(item.actual - item.planned).toLocaleString('pt-BR')} kg
          </span>
        )}
      </td>
    </tr>
  );
}

// ─── Production Page ──────────────────────────────────────────────────────────

export default function Production() {
  const { factory, month, changeMonth, getYearMonth } = useAppStore();
  const { records, setRecords, setLoading } = useProductionStore();
  const { entries } = usePlanningStore();

  const [viewMode, setViewMode] = useState('product'); // 'product' | 'machine' | 'daily'
  const [sortBy, setSortBy] = useState('planned'); // 'planned' | 'actual' | 'pct' | 'name'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'critical' | 'attention' | 'good'
  const [syncing, setSyncing] = useState(false);

  const machines = MACHINES[factory] || [];
  const yearMonth = getYearMonth();
  const monthLabel = getMonthLabel(month.year, month.month);

  // Subscribe a produção realizada do Firebase
  useEffect(() => {
    setLoading(true);
    const unsub = subscribeProductionRecords(factory, yearMonth, (data) => {
      if (data.length === 0) {
        const { production: demo } = seedDemoData();
        const factoryDemo = demo.filter(
          (r) => r.factory === factory && r.date.startsWith(yearMonth)
        );
        setRecords(factoryDemo);
      } else {
        setRecords(data);
      }
    });
    return () => unsub();
  }, [factory, yearMonth]);

  // ─── Agregações ────────────────────────────────────────────────────────

  // Por produto
  const byProduct = (() => {
    const map = {};
    records.forEach((r) => {
      const key = r.productName || r.product;
      if (!map[key]) map[key] = { name: key, planned: 0, actual: 0 };
      map[key].actual += r.actual || 0;
      map[key].planned += r.planned || 0;
    });
    return Object.values(map).map((item) => ({
      ...item,
      pct: item.planned > 0 ? Math.round((item.actual / item.planned) * 100) : 0,
    }));
  })();

  // Por máquina
  const byMachine = (() => {
    const map = {};
    machines.forEach((m) => {
      map[m.id] = { name: m.id, label: m.name, planned: 0, actual: 0 };
    });
    records.forEach((r) => {
      if (map[r.machine]) {
        map[r.machine].actual += r.actual || 0;
        map[r.machine].planned += r.planned || 0;
      }
    });
    return Object.values(map).map((item) => ({
      ...item,
      pct: item.planned > 0 ? Math.round((item.actual / item.planned) * 100) : 0,
    }));
  })();

  // Por dia (últimos 15 dias com dados)
  const byDay = (() => {
    const map = {};
    records.forEach((r) => {
      const date = typeof r.date === 'string' ? r.date : r.date?.toISOString?.()?.split('T')[0];
      if (!date) return;
      if (!map[date]) map[date] = { name: date, planned: 0, actual: 0 };
      map[date].actual += r.actual || 0;
      map[date].planned += r.planned || 0;
    });
    return Object.values(map)
      .map((item) => ({ ...item, pct: item.planned > 0 ? Math.round((item.actual / item.planned) * 100) : 0 }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(-20);
  })();

  // Dataset ativo
  const activeData = viewMode === 'product' ? byProduct : viewMode === 'machine' ? byMachine : byDay;

  // Filtrar
  const filteredData = activeData.filter((item) => {
    if (filterStatus === 'critical') return item.pct < 70;
    if (filterStatus === 'attention') return item.pct >= 70 && item.pct < 85;
    if (filterStatus === 'good') return item.pct >= 85;
    return true;
  });

  // Ordenar
  const sortedData = [...filteredData].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'pct') return b.pct - a.pct;
    if (sortBy === 'actual') return b.actual - a.actual;
    return b.planned - a.planned; // default
  });

  // KPIs globais
  const totalPlanned = records.reduce((s, r) => s + (r.planned || 0), 0);
  const totalActual = records.reduce((s, r) => s + (r.actual || 0), 0);
  const globalPct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
  const globalColors = getAdherenceColor(globalPct);

  const criticalCount = activeData.filter((i) => i.pct < 70).length;
  const attentionCount = activeData.filter((i) => i.pct >= 70 && i.pct < 85).length;

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white">Realizado</h1>
          <p className="text-xs text-brand-muted mt-0.5 capitalize">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Navegação de mês */}
          <div className="flex items-center gap-1 bg-brand-surface/50 rounded-xl p-1 border border-brand-border">
            <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors text-brand-muted hover:text-white">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-medium text-white px-2 min-w-[80px] text-center capitalize">
              {new Date(month.year, month.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
            </span>
            <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors text-brand-muted hover:text-white">
              <ChevronRight size={14} />
            </button>
          </div>

          <button
            onClick={() => setSyncing(true)}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-surface/60 hover:bg-brand-surface border border-brand-border text-white text-xs font-medium rounded-xl transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            Sincronizar
          </button>
        </div>
      </div>

      {/* ─── KPI Cards ─────────────────────────────────────────────────── */}
      <div className="px-6 py-4 grid grid-cols-2 lg:grid-cols-4 gap-3 border-b border-brand-border shrink-0">
        {/* Aderência global */}
        <div className={`rounded-xl p-3.5 border ${globalColors.bg} border-brand-border`}>
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">Aderência Geral</p>
          <div className="flex items-end gap-1">
            <span className={`text-2xl font-mono font-bold ${globalColors.text}`}>{globalPct}%</span>
          </div>
          <div className="mt-2 h-1 bg-brand-bg/40 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${globalColors.bar}`} style={{ width: `${Math.min(globalPct, 100)}%` }} />
          </div>
        </div>

        {/* Total realizado */}
        <div className="rounded-xl p-3.5 border border-brand-border bg-white/[0.02]">
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">Total Realizado</p>
          <p className="text-2xl font-mono font-bold text-white">
            {totalActual >= 1000000
              ? `${(totalActual / 1000000).toFixed(1)}M`
              : totalActual >= 1000
              ? `${(totalActual / 1000).toFixed(0)}k`
              : totalActual.toLocaleString('pt-BR')}
            <span className="text-xs font-normal text-brand-muted ml-1">kg</span>
          </p>
          <p className="text-[10px] text-brand-muted/60 mt-1">
            de {totalPlanned.toLocaleString('pt-BR')} kg planejados
          </p>
        </div>

        {/* Críticos */}
        <div className={`rounded-xl p-3.5 border ${criticalCount > 0 ? 'border-red-500/20 bg-red-500/[0.05]' : 'border-brand-border bg-white/[0.02]'}`}>
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">Críticos</p>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && <AlertTriangle size={14} className="text-red-400" />}
            <span className={`text-2xl font-mono font-bold ${criticalCount > 0 ? 'text-red-400' : 'text-brand-muted'}`}>
              {criticalCount}
            </span>
          </div>
          <p className="text-[10px] text-brand-muted/60 mt-1">abaixo de 70%</p>
        </div>

        {/* Atenção */}
        <div className={`rounded-xl p-3.5 border ${attentionCount > 0 ? 'border-amber-500/20 bg-amber-500/[0.05]' : 'border-brand-border bg-white/[0.02]'}`}>
          <p className="text-[10px] text-brand-muted uppercase tracking-wider mb-1">Atenção</p>
          <span className={`text-2xl font-mono font-bold ${attentionCount > 0 ? 'text-amber-400' : 'text-brand-muted'}`}>
            {attentionCount}
          </span>
          <p className="text-[10px] text-brand-muted/60 mt-1">entre 70% e 85%</p>
        </div>
      </div>

      {/* ─── Toolbar ───────────────────────────────────────────────────── */}
      <div className="px-6 py-3 flex items-center gap-3 border-b border-brand-border shrink-0 flex-wrap">
        {/* View mode */}
        <div className="flex gap-1 bg-brand-surface/40 rounded-xl p-1 border border-brand-border">
          {[
            { id: 'product', label: 'Por Produto' },
            { id: 'machine', label: 'Por Máquina' },
            { id: 'daily',   label: 'Por Dia' },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                viewMode === v.id
                  ? 'bg-brand-surface text-white shadow-sm'
                  : 'text-brand-muted hover:text-white'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Filtro de status */}
        <div className="flex gap-1">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'critical', label: 'Crítico' },
            { id: 'attention', label: 'Atenção' },
            { id: 'good', label: 'Bom' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-all border ${
                filterStatus === f.id
                  ? 'bg-brand-cyan/20 border-brand-cyan/40 text-sky-300'
                  : 'border-transparent text-brand-muted hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Ordenação */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-brand-surface/40 border border-brand-border rounded-xl px-3 py-1.5 text-xs text-brand-muted focus:outline-none focus:border-brand-cyan/40 transition-all"
          >
            <option value="planned">Ordenar: Planejado</option>
            <option value="actual">Ordenar: Realizado</option>
            <option value="pct">Ordenar: Aderência</option>
            <option value="name">Ordenar: Nome</option>
          </select>
        </div>
      </div>

      {/* ─── Tabela ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {sortedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 rounded-full bg-brand-surface/40 flex items-center justify-center mb-3">
              <TrendingUp size={20} className="text-brand-muted/60" />
            </div>
            <p className="text-sm text-brand-muted">Nenhum registro de produção encontrado</p>
            <p className="text-xs text-brand-muted/60 mt-1">Sincronize com o Microdata ou aguarde dados do agente</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="sticky top-0 z-10 bg-brand-bg/95 backdrop-blur-sm border-b border-brand-border">
                <th className="pl-6 pr-2 py-3 text-left w-8">
                  <span className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">#</span>
                </th>
                <th className="px-4 py-3 text-left">
                  <button onClick={() => setSortBy('name')} className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider hover:text-white transition-colors">
                    {viewMode === 'product' ? 'Produto' : viewMode === 'machine' ? 'Máquina' : 'Data'}
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => setSortBy('planned')} className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider hover:text-white transition-colors">
                    Planejado
                  </button>
                </th>
                <th className="px-4 py-3 text-right">
                  <button onClick={() => setSortBy('actual')} className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider hover:text-white transition-colors">
                    Realizado
                  </button>
                </th>
                <th className="px-4 py-3 min-w-[180px]">
                  <button onClick={() => setSortBy('pct')} className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider hover:text-white transition-colors">
                    Aderência
                  </button>
                </th>
                <th className="px-4 py-3 text-right pr-6">
                  <span className="text-[10px] font-semibold text-brand-muted uppercase tracking-wider">Desvio</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item, i) => (
                <ProductRow key={item.name} item={item} rank={i + 1} />
              ))}
            </tbody>

            {/* Footer de totais */}
            <tfoot>
              <tr className="border-t-2 border-white/[0.08] bg-brand-card/60">
                <td colSpan={2} className="pl-6 py-4">
                  <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">
                    Total — {sortedData.length} {viewMode === 'product' ? 'produtos' : viewMode === 'machine' ? 'máquinas' : 'dias'}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="text-sm font-mono font-bold text-white">
                    {sortedData.reduce((s, i) => s + i.planned, 0).toLocaleString('pt-BR')}
                    <span className="text-xs font-normal text-brand-muted ml-1">kg</span>
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className={`text-sm font-mono font-bold ${globalColors.text}`}>
                    {sortedData.reduce((s, i) => s + i.actual, 0).toLocaleString('pt-BR')}
                    <span className="text-xs font-normal text-brand-muted ml-1">kg</span>
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <AdherenceIcon pct={globalPct} />
                    <span className={`text-sm font-mono font-bold ${globalColors.text}`}>{globalPct}%</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getStatusBadge(globalPct).cls}`}>
                      {getStatusBadge(globalPct).label}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 text-right pr-6">
                  {(() => {
                    const totalDev = sortedData.reduce((s, i) => s + i.actual - i.planned, 0);
                    return (
                      <span className={`text-xs font-mono font-bold ${totalDev >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {totalDev >= 0 ? '+' : ''}{totalDev.toLocaleString('pt-BR')} kg
                      </span>
                    );
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
