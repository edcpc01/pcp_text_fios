import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, Activity, Package,
  Calendar, ChevronLeft, ChevronRight, FlaskConical,
} from 'lucide-react';
import { useAppStore, usePlanningStore, useProductionStore, useAdminStore } from '../hooks/useStore';
import {
  subscribeProductionRecords, subscribePlanningEntries,
  subscribeRawMaterialStock, subscribeFinishedGoodsStock,
} from '../services/firebase';
import { getMonthLabel } from '../utils/dates';

function KpiCard({ label, value, unit, sub, trend, accentColor, icon: Icon }) {
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-brand-success' : trend < 0 ? 'text-brand-danger' : 'text-brand-muted';
  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-5 card-hover relative overflow-hidden"
      style={{ borderTop: `2px solid ${accentColor}` }}>
      <div className="flex justify-between items-start mb-3">
        <p className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">{label}</p>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-brand-border flex items-center justify-center">
            <Icon size={16} className="text-brand-cyan" />
          </div>
        )}
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-mono font-bold text-white">{value}</span>
        {unit && <span className="text-sm text-brand-muted mb-1">{unit}</span>}
      </div>
      {sub && (
        <div className="flex items-center gap-1 mt-2">
          <TrendIcon size={11} className={trendColor} />
          <span className="text-xs text-brand-muted">{sub}</span>
        </div>
      )}
    </div>
  );
}

function fmtKg(v) {
  if (v == null) return '—';
  return v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)} kg`;
}

export default function Dashboard() {
  const { factory, month, getYearMonth, changeMonth } = useAppStore();
  const { entriesMap, setEntriesFromArray } = usePlanningStore();
  const { records, setRecords } = useProductionStore();
  const { products: productList } = useAdminStore();

  const yearMonth = getYearMonth();
  const monthLabel = getMonthLabel(month.year, month.month);

  // ── Firebase subscriptions ────────────────────────────────────────────────
  useEffect(() => {
    const unsubP = subscribePlanningEntries(factory, yearMonth, setEntriesFromArray);
    const unsubR = subscribeProductionRecords(factory, yearMonth, setRecords);
    return () => { unsubP(); unsubR(); };
  }, [factory, yearMonth]);

  // ── Stock (Materiais) ─────────────────────────────────────────────────────
  const [rawStock, setRawStock] = useState({});
  const [paStock, setPaStock] = useState({});
  useEffect(() => {
    const u1 = subscribeRawMaterialStock(setRawStock);
    const u2 = subscribeFinishedGoodsStock(setPaStock);
    return () => { u1(); u2(); };
  }, []);

  // ── Date range filter ─────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showDatePicker, setShowDatePicker] = useState(false);
  useEffect(() => { setDateRange({ start: '', end: '' }); setShowDatePicker(false); }, [yearMonth]);

  const hasRange = dateRange.start && dateRange.end;

  // ── Derived planning / production ─────────────────────────────────────────
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const allEntries = Object.values(entriesMap);
  const basePlanning = allEntries.filter(
    (e) => (e.cellType === 'producao' || !e.cellType) &&
      (factory === 'all' || e.factory === factory),
  );

  const activePlanning = hasRange
    ? basePlanning.filter((e) => e.date >= dateRange.start && e.date <= dateRange.end)
    : basePlanning;
  const activeRecords = hasRange
    ? records.filter((r) => r.date >= dateRange.start && r.date <= dateRange.end)
    : records;

  // Total planejado (mês inteiro ou range)
  const totalPlanned = Math.round(activePlanning.reduce((s, e) => s + (e.planned || 0), 0));

  // Planejado até D-1 (sempre calcula no mês corrente, ignora range)
  const plannedD1 = Math.round(
    basePlanning
      .filter((e) => e.date && e.date.startsWith(yearMonth) && e.date <= yesterday)
      .reduce((s, e) => s + (e.planned || 0), 0),
  );

  // Realizado até hoje (tudo sincronizado no período)
  const totalActual = Math.round(activeRecords.reduce((s, r) => s + (r.actual || 0), 0) * 100) / 100;

  // Aderência = realizado / planejado D-1
  const adherence = plannedD1 > 0 ? Math.round((totalActual / plannedD1) * 100) : 0;
  const adColor = adherence >= 90 ? '#10b981' : adherence >= 80 ? '#f59e0b' : '#ef4444';

  // ── Mix de produtos agrupado por cliente ─────────────────────────────────
  const productMixByClient = useMemo(() => {
    // Lookup: product ID → cliente
    const clienteById = {};
    const clienteByName = {};
    productList.forEach((p) => {
      const cliente = p.cliente || '';
      if (p.id)             clienteById[p.id]             = cliente;
      if (p.nome)           clienteByName[p.nome]         = cliente;
      if (p.name)           clienteByName[p.name]         = cliente;
    });

    // Agrupa por cliente → por produto
    const clientMap = {}; // { cliente: { products: { name: kg }, total: kg } }
    activePlanning.forEach((e) => {
      const pName  = e.productName || 'Sem nome';
      const rawC   = clienteById[e.product] ?? clienteByName[e.productName] ?? '';
      const cliente = rawC || 'Sem Cliente';
      if (!clientMap[cliente]) clientMap[cliente] = { products: {}, total: 0 };
      if (!clientMap[cliente].products[pName]) clientMap[cliente].products[pName] = 0;
      clientMap[cliente].products[pName] += e.planned || 0;
      clientMap[cliente].total            += e.planned || 0;
    });

    return Object.entries(clientMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([cliente, data]) => ({
        cliente,
        total: data.total,
        products: Object.entries(data.products).sort((a, b) => b[1] - a[1]),
      }));
  }, [activePlanning, productList]);

  // ── Stock totals ──────────────────────────────────────────────────────────
  const totalMpKg = Object.values(rawStock).reduce((s, v) => s + (v.estoqueKg || 0), 0);
  const totalPaKg = Object.values(paStock).reduce((s, v) => s + (v.estoqueKg || 0), 0);
  const topMps = Object.entries(rawStock)
    .map(([k, v]) => ({ code: v.code || k, desc: v.descricao || k, kg: v.estoqueKg || 0 }))
    .filter((v) => v.kg > 0)
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 8);

  const topPas = Object.entries(paStock)
    .map(([k, v]) => ({ id: k, code: v.codigoMicrodata || k, name: v.productName || k, kg: v.estoqueKg || 0 }))
    .filter((v) => v.kg > 0)
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 8);

  return (
    <div className="p-6 space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-brand-muted mt-0.5 capitalize">{monthLabel}</p>
        </div>

        {/* Filtro de período */}
        <div className="flex bg-brand-surface border border-brand-border rounded-lg p-1 self-start sm:self-auto relative">
          <div className="flex items-center space-x-1">
            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-brand-card rounded text-brand-muted hover:text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
            <span
              className="text-sm font-medium text-white px-3 capitalize min-w-[120px] text-center cursor-pointer select-none hover:text-brand-cyan transition-colors"
              onDoubleClick={() => setShowDatePicker(true)}
              title="Duplo clique para filtrar período"
            >
              {hasRange
                ? `${dateRange.start.split('-').reverse().join('/')} à ${dateRange.end.split('-').reverse().join('/')}`
                : monthLabel}
            </span>
            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-brand-card rounded text-brand-muted hover:text-white transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          {showDatePicker && (
            <div className="absolute top-[calc(100%+0.5rem)] sm:right-0 left-0 z-50 bg-brand-card border border-brand-border rounded-xl p-4 shadow-xl flex flex-col gap-3 animate-fade-in shadow-black/50">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">Data Inicial</label>
                  <input type="date" className="bg-brand-surface text-white text-sm rounded border border-brand-border p-2 focus:outline-none focus:border-brand-cyan"
                    value={dateRange.start} onChange={(e) => setDateRange((p) => ({ ...p, start: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-brand-muted uppercase font-bold tracking-widest">Data Final</label>
                  <input type="date" className="bg-brand-surface text-white text-sm rounded border border-brand-border p-2 focus:outline-none focus:border-brand-cyan"
                    value={dateRange.end} min={dateRange.start} onChange={(e) => setDateRange((p) => ({ ...p, end: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-1">
                <button onClick={() => { setDateRange({ start: '', end: '' }); setShowDatePicker(false); }}
                  className="text-xs text-brand-muted hover:text-white px-3 py-1.5 rounded transition-colors">Limpar</button>
                <button onClick={() => setShowDatePicker(false)}
                  className="text-xs bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 font-bold rounded px-4 py-1.5 hover:bg-brand-cyan/20 transition-colors">Aplicar</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KPIs — 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Planejado"
          value={totalPlanned >= 1000 ? `${(totalPlanned / 1000).toFixed(1)}k` : totalPlanned}
          unit="kg"
          accentColor="#8b5cf6"
          icon={Calendar}
          sub={hasRange ? 'Período selecionado' : `${month.year} — mês completo`}
        />
        <KpiCard
          label="Planejado até D-1"
          value={plannedD1 >= 1000 ? `${(plannedD1 / 1000).toFixed(1)}k` : plannedD1}
          unit="kg"
          accentColor="#06b6d4"
          icon={Calendar}
          sub={`até ${yesterday.split('-').reverse().join('/')}`}
        />
        <KpiCard
          label="Realizado até hoje"
          value={totalActual >= 1000 ? `${(totalActual / 1000).toFixed(1)}k` : totalActual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          unit="kg"
          accentColor="#22d3ee"
          icon={TrendingUp}
          trend={totalActual >= plannedD1 * 0.9 ? 1 : -1}
          sub="tudo sincronizado"
        />
        <KpiCard
          label="Aderência"
          value={`${adherence}%`}
          accentColor={adColor}
          icon={Activity}
          trend={adherence >= 90 ? 1 : -1}
          sub="realizado ÷ planejado D-1"
        />
      </div>

      {/* Mix de Produtos por Cliente */}
      <div className="bg-brand-card border border-brand-border rounded-2xl p-5" style={{ borderTop: '2px solid #f97316' }}>
        <h3 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4 flex items-center gap-2">
          <Package size={13} className="text-brand-orange" /> Mix de Produtos Planejados
        </h3>
        {productMixByClient.length > 0 ? (
          <div className="space-y-5">
            {productMixByClient.map(({ cliente, total, products }) => {
              const clientePct = totalPlanned > 0 ? Math.round((total / totalPlanned) * 100) : 0;
              const COLORS = ['#f97316','#22d3ee','#8b5cf6','#10b981','#f59e0b','#ec4899','#6366f1','#14b8a6'];
              const barColor = COLORS[productMixByClient.findIndex((c) => c.cliente === cliente) % COLORS.length];
              return (
                <div key={cliente}>
                  {/* Cliente header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: barColor }} />
                      <span className="text-xs font-bold text-white uppercase tracking-wide">{cliente}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold" style={{ color: barColor }}>
                        {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : Math.round(total)} kg
                      </span>
                      <span className="text-[10px] text-brand-muted font-mono">({clientePct}%)</span>
                    </div>
                  </div>
                  {/* Subtotal bar do cliente */}
                  <div className="h-1 bg-brand-surface rounded-full overflow-hidden mb-3">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${clientePct}%`, background: barColor }} />
                  </div>
                  {/* Produtos do cliente */}
                  <div className="space-y-2 pl-4">
                    {products.map(([name, val]) => {
                      const pct = totalPlanned > 0 ? Math.round((val / totalPlanned) * 100) : 0;
                      return (
                        <div key={name}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-300 font-medium truncate pr-4" title={name}>{name}</span>
                            <span className="text-brand-muted font-mono whitespace-nowrap shrink-0">
                              {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val)} kg
                              <span className="ml-1 text-[10px] opacity-60">({pct}%)</span>
                            </span>
                          </div>
                          <div className="h-1 bg-brand-surface rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${pct}%`, background: barColor, opacity: 0.6 }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-brand-muted text-sm text-center py-6">Sem dados de planejamento</p>
        )}
      </div>

      {/* Estoque — dois cards lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Card Matéria-Prima */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5" style={{ borderTop: '2px solid #22d3ee' }}>
          <h3 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <FlaskConical size={13} className="text-brand-cyan" /> Estoque Matéria-Prima
          </h3>
          <div className="bg-brand-surface rounded-xl px-4 py-3 border border-brand-border mb-4">
            <p className="text-[10px] text-brand-muted uppercase tracking-widest mb-0.5">Total (Microdata)</p>
            <p className="text-2xl font-mono font-bold text-white">{fmtKg(totalMpKg)}</p>
          </div>
          {topMps.length > 0 ? (
            <div className="space-y-1.5">
              {topMps.map((mp) => (
                <div key={mp.code} className="flex items-center justify-between bg-brand-surface rounded-lg px-3 py-2 border border-brand-border/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-brand-muted font-mono">{mp.code}</p>
                    <p className="text-xs text-white truncate" title={mp.desc}>{mp.desc}</p>
                  </div>
                  <span className="font-mono font-bold text-brand-cyan text-sm ml-3 shrink-0">{fmtKg(mp.kg)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-brand-muted text-sm text-center py-4">Sincronize na página Materiais</p>
          )}
        </div>

        {/* Card Produto Acabado */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5" style={{ borderTop: '2px solid #8b5cf6' }}>
          <h3 className="text-xs font-bold text-brand-muted uppercase tracking-widest mb-4 flex items-center gap-2">
            <Package size={13} className="text-brand-agent" /> Estoque Produto Acabado
          </h3>
          <div className="bg-brand-surface rounded-xl px-4 py-3 border border-brand-border mb-4">
            <p className="text-[10px] text-brand-muted uppercase tracking-widest mb-0.5">Total (Microdata)</p>
            <p className="text-2xl font-mono font-bold text-white">{fmtKg(totalPaKg)}</p>
          </div>
          {topPas.length > 0 ? (
            <div className="space-y-1.5">
              {topPas.map((pa) => (
                <div key={pa.id} className="flex items-center justify-between bg-brand-surface rounded-lg px-3 py-2 border border-brand-border/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-brand-muted font-mono">{pa.code}</p>
                    <p className="text-xs text-white truncate" title={pa.name}>{pa.name}</p>
                  </div>
                  <span className="font-mono font-bold text-brand-agent text-sm ml-3 shrink-0">{fmtKg(pa.kg)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-brand-muted text-sm text-center py-4">Sincronize na página Materiais</p>
          )}
        </div>

      </div>

    </div>
  );
}
